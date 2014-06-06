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
  var database = initDatabase( filename );

  var nbCardsToInsert = 0;
  var nbCardsInserted = 0;

  function closeDatabaseIfDone() {
    nbCardsInserted++;

    if ( nbCardsInserted == nbCardsToInsert ) {
      database.close();
    }
  }

  cards.forEach( function ( card ) {
    if ( card.type == 'Enchantment' || card.type == 'Hero' ) {
      return;
    }

    nbCardsToInsert++;

    getCardImage( card.id, function ( error, cardImage ) {
      if ( error ) {
        console.log( error );
        console.log( JSON.stringify( card ) );
      }
      else {
        insertCard( card, cardImage, database );
      }

      closeDatabaseIfDone();
    } );
  } );
}

function initDatabase( filename ) {
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
                  "card BLOB NOT NULL" +
                  ")" );
  } );

  return database;
}

function insertCard( element, cardImage, database ) {
  var name = element.name;
  var cost = element.cost;
  if ( cost == undefined ) { // Fix for 'The Coin'.
    cost = 0;
  }

  var attack = element.attack;
  var health = element.health;
  var abilities = element.mechanics ? element.mechanics.join() : null;
  var rarity = element.rarity;
  var type = element.type;
  var race = element.race;
  var clazz = element.playerClass;
  var game_id = element.id;

  database.run( "INSERT INTO cards VALUES (NULL, ?,?,?,?,?,?,?,?,?,?,?)", name, cost, attack, health, abilities, rarity, type, race, clazz, game_id, cardImage );
}

function getCardImage( card_id, callback ) {
  var remoteOptions = {
    hostname: 'wow.zamimg.com',
    port: 80,
    path: '/images/hearthstone/cards/enus/original/' + card_id + '.png',
    method: 'GET',
    encoding: null
  };

  var request = Http.request( remoteOptions, function ( response ) {
    var imageData = '';

    response.setEncoding( 'binary' );
    response.on( 'data', function ( chunck ) {
      imageData += chunck;
    } );

    response.on( 'end', function () {
      callback( null, imageData );
    } )
  } );

  request.on( 'error', function ( error ) {
    callback( error, null );
  } );

  request.end();
}
