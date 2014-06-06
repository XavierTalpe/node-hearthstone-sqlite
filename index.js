var Async = require( 'async' );
var Http = require( 'http' );
var SQLite3 = require( 'sqlite3' ).verbose();
var FileSystem = require( 'fs' );

var DB_FILE_NAME = 'out/hearthstone-v1.0.sqlite';

Async.waterfall( [
                   function ( callback ) {
                     var remoteOptions = {
                       hostname: 'hearthstonejson.com',
                       port: 80,
                       path: '/json/AllSets.json',
                       method: 'GET'
                     };

                     downloadCardsAsJson( remoteOptions, callback );
                   },
                   function ( allCards, callback ) {
                     var basicCards = allCards.Basic;
                     var expertCards = allCards.Expert;

                     var cards = basicCards.concat( expertCards );

                     callback( null, cards, callback );
                   },
                   function ( cards, callback ) {
                     FileSystem.unlink( DB_FILE_NAME, function ( error ) {
                       if ( error ) {
                         // File doesn't exist, skip error.
                       }

                       writeToDatabase( DB_FILE_NAME, cards );
                     } );
                   }
                 ] );

function downloadCardsAsJson( remoteOptions, callback ) {
  var request = Http.request( remoteOptions, function ( response ) {
    var jsonData = "";

    response.setEncoding( 'utf8' );
    response.on( 'data', function ( jsonChunk ) {
      jsonData += jsonChunk;
    } );

    response.on( 'end', function () {
      callback( null, JSON.parse( jsonData ) );
    } )
  } );

  request.on( 'error', function ( error ) {
    callback( error.message, null );
  } );

  request.end();
}

function writeToDatabase( filename, cards ) {
  var database = new SQLite3.Database( filename );

  database.serialize( function () {
    database.run( "CREATE TABLE cards (" +
                  "_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                  "name TEXT NOT NULL," +
                  "cost INTEGER NOT NULL," +
                  "attack INTEGER," +
                  "health INTEGER," +
                  "abilities TEXT," +
                  "rarity TEXT," +
                  "type TEXT NOT NULL," +
                  "race TEXT," +
                  "class TEXT," +
                  "game_id TEXT NOT NULL," +
                  "card BLOB" +
                  ")" );

    var sqlStatement = database.prepare( "INSERT INTO cards VALUES (NULL, ?,?,?,?,?,?,?,?,?,?,?)" );

    cards.forEach( function ( element ) {
      if ( element.type == 'Enchantment' || element.type == 'Hero' ) {
        return;
      }

      var name = element.name;
      var cost = element.cost;
      var attack = element.attack;
      var health = element.health;
      var abilities = element.mechanics;
      var rarity = element.rarity;
      var type = element.type;
      var race = element.race;
      var clazz = element.playerClass;
      var game_id = element.id;
      var card = null;

      if ( cost == undefined ) { // Fix for 'The Coin'.
        cost = 0;
      }

      sqlStatement.run( name, cost, attack, health, abilities, rarity, type, race, clazz, game_id, card );
    } );

    sqlStatement.finalize();
  } );

  database.close();
}
