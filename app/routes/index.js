var express    = require('express');
var router     = express.Router();
var mysql      = require('mysql');
var pool = mysql.createPool({
    connectionLimit : 100, // important
    host     : 'localhost',
    port     : '5228',
    user     : 'plzshow',
    password : 'Makaron9079*',
    database : 'db'
});

var server_ip   = '52.78.200.87';
var server_port = '3000';
var server_log  = '';

/* GET home page. */
router.get('/', function(req, res, next) {
  pool.getConnection(function(err, connection) {
    if (err) return next(err);
    connection.query('SELECT * FROM users', function(err, rows, fields) {
      connection.release();
      
      server_log = 'GET Request received on' + server_ip + ':' + server_port;
      console.log(server_log);

      if (isEmpty(rows)) {
        server_log = 'Result row is an empty object';
        console.log(server_log);
        return next(err);
      }
      else {
        var userArray = []
        var results = { result : 'success' };
        for (var i in rows) {
          userArray = userArray.concat({
            id : rows[i].id,
            name : rows[i].name,
            phone : rows[i].phone,
            coin : rows[i].coin,
            pic : rows[i].pic,
            joindate : rows[i].joindata});
        }
        
        console.log(userArray);
        results['users'] =  userArray;
        res.json(results);
      }
    });

    connection.on('error', function(err) {
      if (err) return next(err);
    });
  });
});

////////////////////////////////////////////////////////////////////////////

router.post('/', function(req, res, next) {
  var json = req.body;
  if (isEmpty(json)) {
    res.json({result:'failed', description:'json body is empty'});
    return;
  }
  if (!json.type) {
    res.json({result:'failed', description:'you must specify type'});
    return;
  }
  switch(json.type) {
    case 'NEW_USER':
      res.json({result:'success', description:'NEW_USER'});
    break;

    default:
      res.json({result:'failed', description:'unknown type'});
  }
});

////////////////////////////////////////////////////////////////////////////

// Speed up calls to hasOwnProperty
var hasOwnProperty = Object.prototype.hasOwnProperty;

/*
function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}
*/

function isEmpty(obj) {

    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

    // If it isn't an object at this point
    // it is empty, but it can't be anything *but* empty
    // Is it empty?  Depends on your application.
    if (typeof obj !== "object") return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}

module.exports = router;
