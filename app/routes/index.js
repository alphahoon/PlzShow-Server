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
  console.log(json);

  if (isEmpty(json)) {
    res.json({result:'failed', description:'json body is empty'});
    return;
  }
  if (!json.type) {
    res.json({result:'failed', description:'you must specify type'});
    return;
  }

  // should release connection before the last callback function
  pool.getConnection(function(err, connection) {
    if (err) return next(err);
    var query = '';
    switch(json.type) {
      case 'GET_USER':
        if (!json.user_id) {
          res.json({result:'failed', description:'user_id field not found'});
          connection.release();
          return;
        }
        query = 'SELECT * FROM users WHERE id = ?';
        connection.query(query, [json.user_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }

          if (isEmpty(rows)) {
            res.json({result:'failed', description:'user_id not found'});
            connection.release();
            return;
          }
          else {
            var response = {result:'success'};
            response['name'] = rows[0].name;
            response['phone'] = rows[0].phone;
            response['coin'] = rows[0].coin;
            response['pic'] = rows[0].pic;
            response['joindate'] = rows[0].joindate;
            console.log(response);
            res.json(response);
            connection.release();
            return;
          }
        });
        break;

/*
      case 'NEW_USER':
        if (!json.user_id) {
          res.json({result:'failed', description:'user_id field not found'});
          connection.release();
          return;
        }
        if (!json.name || !json.phone) {
          res.json({result:'failed', description:'name or phone fields not found'});
          connection.release();
          return;
        }
        query = 'SELECT * FROM users WHERE id = ?';
        connection.query(query, [json.user_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          if (!isEmpty(rows)) { 
            res.json({result:'failed', description:'user_id already exists'});
            connection.release();
            return;
          }
          else {
            query = 'INSERT INTO users (id, name, phone, joindate) VALUES (?, ?, ?, ?)';
            connection.query(query, [json.user_id, json.name, json.phone, getLocalTime()], function(err, rows, fields) {
              if (err) {
                connection.release();
                return next(err);
              }
              else {
                res.json({result:'success', description:'new user created with the given id'});
                connection.release();
                return;
              }
            });
          }
        });
        break;
*/

    case 'LOGIN':
      // id, name, token
      if (!json.user_id || !json.name || !json.token) {
        res.json({result:'failed', description:'user_id or name or token field not found'});
        connection.release();
        return;
      }
      query = 'SELECT * FROM users WHERE id = ?';
      connection.query(query, [json.user_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (!isEmpty(rows)) {
          // IF THE USER EXISTS, UPDATE USER WITH ID, NAME, TOKEN
          query = 'UPDATE users SET name = ?, token = ? WHERE id = ?';
          connection.query(query, [json.name, json.token, json.user_id], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
            res.json({result:'success', description:'updated the user with the given id'});
            connection.release();
            return;
          });
        }
        else {
          // IF NOT EXISTS, CREATE USER WITH ID, NAME, TOKEN, CURRENT TIME
          query = 'INSERT INTO users (id, name, joindate, token) VALUES (?, ?, ?, ?)';
          connection.query(query, [json.user_id, json.name, getLocalTime(), json.token], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
            res.json({result:'success', description:'new user created with the given id, name, and token'});
            connection.release();
            return;
          });
        }
      });
      break;

    default:
      res.json({result:'failed', description:'unknown type'});
      return;
      break;
    }
  });
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

function trimTimeFormat(time) {
  return time.toISOString().slice(0,19).replace('T', ' ');
}

function GMTtoKST(date) {
  var timeOffset = 9 * 60 * 60 * 1000;
  var localTime = date.getTime() + timeOffset;
  return trimTimeFormat(new Date(localTime));
}

function getLocalTime() {
  return GMTtoKST(new Date());
}

module.exports = router;
