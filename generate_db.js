var Async = require( 'async' );
var Http = require( 'http' );


Async.waterfall( [
                   function ( callback ) {
                     var remoteOptions = {
                       hostname: 'hearthstonejson.com',
                       port: 80,
                       path: '/json/AllSets.json',
                       method: 'GET'
                     };

                     downloadAsJson( remoteOptions, callback );
                   }                                                       ,
                   function ( jsonData, callback ) {
                     console.log( "jsonData" );
                   }
//                   },
//                   function ( results, callback ) {
//                     callback( null, results );
//                   }
                 ],
                 function ( error, results ) {
                   if ( error ) {
                     console.log( error );
                   }
                   else {
                     console.log( "Results" );
                     console.log( "results" );
                   }
                 } );

function downloadAsJson( remoteOptions, callback ) {
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

var sqlite3 = require( 'sqlite3' ).verbose();
var db = new sqlite3.Database( ':memory:' );

db.serialize( function () {
  db.run( "CREATE TABLE lorem (info TEXT)" );

  var stmt = db.prepare( "INSERT INTO lorem VALUES (?)" );
  for ( var i = 0; i < 10; i++ ) {
    stmt.run( "Ipsum " + i );
  }
  stmt.finalize();

  db.each( "SELECT rowid AS id, info FROM lorem", function ( err, row ) {
    console.log( row.id + ": " + row.info );
  } );
} );

db.close();
