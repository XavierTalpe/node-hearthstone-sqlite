var Async = require( 'async' );
var Http = require( 'http' );
var SQLite3 = require( 'sqlite3' ).verbose();
var FileSystem = require( 'fs' );
var EasyImg = require( 'easyimage' );

var TARGET_DIR = 'out/';
var TEMP_DIR = TARGET_DIR + 'tmp/';
var DB_FILE_NAME = TARGET_DIR + 'hearthstone-v1.0.sqlite';

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

  var host = 'wow.zamimg.com';
  var basePath = '/images/hearthstone/cards/enus/original/';

  cards.forEach( function ( card ) {
    if ( card.type == 'Enchantment' || card.type == 'Hero' || card.type == 'Hero Power' ) {
      return;
    }

    nbCardsToInsert++;

    Async.waterfall( [
                       function ( callback ) {
                         var sourceFilename = card.id + '.png';
                         var path = basePath + sourceFilename;

                         downloadFile( host, path, callback );
                       }                                         ,
                       function ( imageData, callback ) {
                         var targetFilename = card.id + '.png';

                         writeBinaryFile( TEMP_DIR + targetFilename, imageData, callback )
                       },
                       function ( sourceFilename, callback ) {
                         var targetFilename = sourceFilename.replace( '.png', '.jpg' );

                         EasyImg.crop( {
                                         src: sourceFilename, dst: targetFilename,
                                         cropwidth: 290, cropheight: 410,
                                         gravity: 'North',
                                         x: 5, y: 32
                                       },
                                       function ( error ) {
                                         callback( error, targetFilename );
                                       } );
                       },
                       function ( sourceFilename, callback ) {
                         FileSystem.readFile( sourceFilename, callback );
                       },
                       function ( imageData, callback ) {
                         insertCard( card, imageData, database );

                         callback( null );
                       }
                     ],
                     function ( error ) {
                       if ( error ) {
                         console.log( error );
                         console.log( JSON.stringify( card ) );
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

function downloadFile( host, path, callback ) {
  var remoteOptions = {
    hostname: host,
    port: 80,
    path: path,
    method: 'GET',
    encoding: null
  };

  var request = Http.request( remoteOptions, function ( response ) {
    var binaryData = '';

    response.setEncoding( 'binary' );
    response.on( 'data', function ( chunck ) {
      binaryData += chunck;
    } );

    response.on( 'end', function () {
      callback( null, binaryData );
    } )
  } );

  request.on( 'error', function ( error ) {
    callback( error, null );
  } );

  request.end();
}

function writeBinaryFile( filename, data, callback ) {
  FileSystem.writeFile( filename, data, 'binary', function ( err ) {
    if ( err ) {
      callback( err );
    }

    callback( null, filename );
  } );
}
