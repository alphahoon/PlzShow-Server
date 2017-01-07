var express    = require('express');
var router     = express.Router();
var mysql      = require('mysql');
var path       = require('path');
var fs         = require('fs');
var FCM        = require('fcm-push');
var crypto     = require('crypto');

var pool = mysql.createPool({
    connectionLimit : 100,
    host     : 'localhost',
    port     : '5228',
    user     : 'plzshow',
    password : 'Makaron9079*',
    database : 'db'
}); 

var api_key = 'AAAAiaASgRA:APA91bGhAAAB1N__438GTHmA81tB4MOt2pGIokoxkY6Xj2hthwLwJqdKIGeoQyFcpbAa5HqQqGFDGbJ0TADJfeJ3450NsY03pB3ODxov3LUCIN7Fx_ykpgeQuPDAHVt2MEWYvcnKRHOo';
var fcm = new FCM(api_key);

var http_protocol = 'http://';
var server_address = '52.78.200.87:3000';
var img_write_path = '/../public/images/';
var img_access_path = '/static/images/';
var img_file_prefix = 'img_';

/* GET home page. */
router.get('/', function(req, res, next) {
  pool.getConnection(function(err, connection) {
    if (err) return next(err);
    connection.query('SELECT * FROM users', function(err, rows, fields) {
      connection.release();
      if (isEmpty(rows)) {
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
/*
 *  < AVAILABLE METHOD 'type's >
 *  [METHOD_NAME]: [REQUIRED_JSON_FIELDS_OF_REQUEST] => [JSON_FIELDS_OF_RESPONSE]
 *
 *  USER_LOGIN: type, user_id, token => result, description
 *  GET_USER: type, user_id => result, name, phone, coin, pic, joindate
 *  UPLOAD_USER_PIC: type, user_id, img(BASE64_ENCODED) => result, description
 *  UPDATE_USER_INFO: type, user_id, name, phone => result, description
 *
 *  REST_LOGIN: type, rest_id, token => result, description
 *  GET_REST: type, rest_id => result, name, phone, location, coin, pic, type,
 *    description, respond_time, oper_time, rest_time, holiday, price, reserv_price
 *  UPLOAD_REST_PIC: type, rest_id, img(BASE64_ENCODED) => result, description
 *  UPLOAD_REST_GALLERY: type, rest_id, img[img1, img2, ... , imgN] => result, description
 *  UPDATE_REST_INFO: type, rest_id, name, phone, location, type, description,
 *    oper_time, rest_time, holiday, price, reserv_price => result, description
 *
 *  GET_REST_LIST: type => result, restaurants[{name, phone, location, pic,
 *    type, description, respond_time, oper_time, rest_time, holiday, price, 
 *    reserv_price} ... ]
 */
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

  // SHOULD RELEASE CONNECTION BEFORE THE LAST CALLBACK FUNCTION OR RETURN
  pool.getConnection(function(err, connection) {
    if (err) return next(err);
    var query = '';
    switch(json.type) {
      case 'USER_LOGIN':
      // id, name, token
      var message = {
        to: 'e7GWLwq21U4:APA91bE0MeYOnVLeZg5LTFQvlo_PA3XQeHTI-ijyUjcY_TeJkWXixIzHqqorngPv5GyYKR9ZgWBlfzjhFoZEDfTCt9_e1aF-YmlVZe9UitMN6M4hELkiWJhIzubTVGV1yU39cRiW8DO7',
        data: {
          monkey: 'hello monkey',
          mk: 'monkey monkey'
        },
        notification: {
          title: 'test_title',
          body: 'test_body'
        }
      };

      //callback style
      fcm.send(message, function(err, response){
          if (err) {
            console.log(err);
            console.log('Something has gone wrong!');
          } else {
            console.log('Successfully sent with response:', response);
          }
      });

      if (!json.user_id || !json.name || !json.token) {
        connection.release();
        res.json({result:'failed', description:'user_id or name or token field not found'});
        return;
      }
      query = 'SELECT * FROM users WHERE id = ?';
      connection.query(query, [json.user_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (!isEmpty(rows)) {
          // IF THE USER EXISTS, UPDATE THE USER WITH NAME, TOKEN
          query = 'UPDATE users SET name = ?, token = ? WHERE id = ?';
          connection.query(query, [json.name, json.token, json.user_id], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
            connection.release();
            res.json({result:'success', description:'updated the user with the given id'});
            return;
          });
        }
        else {
          // IF NOT EXISTS, CREATE AN USER WITH ID, NAME, CURRENT TIME AND TOKEN
          query = 'INSERT INTO users (id, name, joindate, token) VALUES (?, ?, ?, ?)';
          connection.query(query, [json.user_id, json.name, getLocalTime(), json.token], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
            connection.release();
            res.json({result:'success', description:'new user created with the given id, name, and token'});
            return;
          });
        }
      });
      break;

      case 'GET_USER':
        if (!json.user_id) {
          connection.release();
          res.json({result:'failed', description:'user_id field not found'});
          return;
        }
        query = 'SELECT * FROM users WHERE id = ?';
        connection.query(query, [json.user_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }

          if (isEmpty(rows)) {
            connection.release();
            res.json({result:'failed', description:'user_id not found'});
            return;
          }
          else {
            var response = {result:'success'};
            response['name'] = rows[0].name;
            response['phone'] = rows[0].phone;
            response['coin'] = rows[0].coin;
            response['pic'] = rows[0].pic;
            response['joindate'] = rows[0].joindate;
            connection.release();
            res.json(response);
            return;
          }
        });
        break;

    case 'UPLOAD_USER_PIC':
      // user_id, img:base64 encoded img
      if (!json.user_id || !json.img) {
        connection.release();
        res.json({result:'failed', description:'user_id or img not found'});
        return;
      }
      query = 'SELECT * FROM users WHERE id = ?';
      connection.query(query, [json.user_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'user_id not exists'});
          return next(err);
        }
        var url = saveImageSync(json.img);
        query = 'UPDATE users SET pic = ? WHERE id = ?';
        connection.query(query, [url, json.user_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          connection.release();
          res.json({result:'success', description:'updated user pic'});
          return;
        });
      });
      break;

    case 'UPDATE_USER_INFO':
      // user_id, name, phone
      if (!json.user_id || !json.name || !json.phone) {
        connection.release();
        res.json({result:'failed', description:'user_id or name or phone not found'});
        return;
      }
      query = 'SELECT * FROM users WHERE id = ?';
      connection.query(query, [json.user_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'user_id not exists'});
          return next(err);
        }
        query = 'UPDATE users SET name = ?, phone = ? WHERE id = ?';
        connection.query(query, [json.name, json.phone, json.user_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          connection.release();
          res.json({result:'success', description:'updated user info'});
          return;
        });
      });
      break;

    case 'REST_LOGIN':
      // id, name, token
      if (!json.rest_id || !json.name || !json.token) {
        connection.release();
        res.json({result:'failed', description:'rest_id or name or token field not found'});
        return;
      }
      query = 'SELECT * FROM restaurants WHERE id = ?';
      connection.query(query, [json.rest_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (!isEmpty(rows)) {
          // IF THE RESTAURANT EXISTS, UPDATE THE RESTAURANT WITH NAME, TOKEN
          query = 'UPDATE users SET name = ?, token = ? WHERE id = ?';
          connection.query(query, [json.name, json.token, json.rest_id], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
            connection.release();
            res.json({result:'success', description:'updated the restaurant with the given id'});
            return;
          });
        }
        else {
          // IF NOT EXISTS, CREATE A RESTAURANT WITH ID, NAME, AND TOKEN
          query = 'INSERT INTO restaurants (id, name, token) VALUES (?, ?, ?)';
          connection.query(query, [json.rest_id, json.name, json.token], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
            connection.release();
            res.json({result:'success', description:'new restaurant created with the given id, name, and token'});
            return;
          });
        }
      });
      break;
      
    case 'GET_REST':
      query = 'SELECT * FROM restaurants';
      connection.query(query, function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'rest_id not exists'});
          return next(err);
        }
        var results = {result:'success',
          rest_id : rows[0].id,
          name : rows[0].name,
          phone : rows[0].phone,
          location : rows[0].location,
          coin : rows[0].coin,
          pic : rows[0].pic,
          type : rows[0].type,
          description : rows[0].description,
          respond_time : rows[0].respond_time,
          oper_time : rows[0].oper_time,
          rest_time : rows[0].rest_time,
          holiday : rows[0].holiday,
          price : rows[0].price,
          reserv_price : rows[0].reserv_price
        };
        connection.release();
        res.json(results);
        return;
      });
      break;

    case 'UPLOAD_REST_PIC':
      // rest_id, img:base64 encoded img
      if (!json.rest_id || !json.img) {
        connection.release();
        res.json({result:'failed', description:'rest_id or img not found'});
        return;
      }
      query = 'SELECT * FROM restaurants WHERE id = ?';
      connection.query(query, [json.rest_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'rest_id not exists'});
          return next(err);
        }
        var url = saveImageSync(json.img);
        query = 'UPDATE restaurants SET pic = ? WHERE id = ?';
        connection.query(query, [url, json.rest_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          connection.release();
          res.json({result:'success', description:'updated restaurant pic'});
          return;
        });
      });
      break;

    case 'UPLOAD_REST_GALLERY':
      // rest_id, img: [base64 encoded img ...]
      if (!json.rest_id || !json.img) {
        connection.release();
        res.json({result:'failed', description:'rest_id or img not found'});
        return;
      }
      query = 'SELECT * FROM restaurants WHERE id = ?';
      connection.query(query, [json.rest_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'rest_id not exists'});
          return next(err);
        }
        for (var i in json.img) {
          var url = saveImageSync(json.img[i]);
          query = 'INSERT INTO photos (rest_id, photo) VALUES (?, ?)';
          connection.query(query, [json.rest_id, url], function(err, rows, fields) {
            if (err) {
              connection.release();
              return next(err);
            }
          });
        }
        connection.release();
        res.json({result:'success', description:'uploaded gallery photos'});
        return;
      });
      break;

    case 'UPDATE_REST_INFO':
      // rest_id, name, phone, location, type, description, oper_time, rest_time, holiday, price, reserv_price
      if (!json.rest_id || !json.name || !json.phone || !json.location || !json.type || !json.description
         || !json.oper_time || !json.rest_time || !json.holiday || !json.price || !json.reserv_price) {
        connection.release();
        res.json({result:'failed', description:'some fields are not found'});
        return;
      }
      query = 'SELECT * FROM restaurants WHERE id = ?';
      connection.query(query, [json.rest_id], function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'user_id not exists'});
          return next(err);
        }
        query = 'UPDATE restaurants SET name = ?, phone = ?, location = ?, type = ?, description = ?, oper_time = ?, rest_time = ?, holiday = ?, price = ?, reserv_price = ? WHERE id = ?';
        connection.query(query, [json.name, json.phone, json.location, json.type, json.description, json.oper_time, json.rest_time, json.holiday, json.price, json.reserv_price, json.rest_id], function(err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          connection.release();
          res.json({result:'success', description:'updated restaurant info'});
          return;
        });
      });
      break;

    case 'GET_REST_LIST':
      query = 'SELECT * FROM restaurants';
      connection.query(query, function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          // NO RESTAURANTS REGISTERED
          connection.release();
          res.json({result:'success', restaurants: []});
          return next(err);
        }
        var restArray = [];
        var results = {result:'success'};
        for (var i in rows) {
          restArray = restArray.concat({
            rest_id : rows[i].id,
            name : rows[i].name,
            phone : rows[i].phone,
            location : rows[i].location,
            pic : rows[i].pic,
            type : rows[i].type,
            description : rows[i].description,
            respond_time : rows[i].respond_time,
            oper_time : rows[i].oper_time,
            rest_time : rows[i].rest_time,
            holiday : rows[i].holiday,
            price : rows[i].price,
            reserv_price : rows[i].reserv_price
          });
        }
        results['restaurants'] = restArray;
        connection.release();
        res.json(results);
        return;
      });
      break;

    case 'MAKE_RESERVATION':
      break;

    default:
      connection.release();
      res.json({result:'failed', description:'unknown type'});
      return;
      break;
    }
  });
});

////////////////////////////////////////////////////////////////////////////

// Speed up calls to hasOwnProperty
var hasOwnProperty = Object.prototype.hasOwnProperty;

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

function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),response = {};

  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }

  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');

  return response;
}

function getImageContainer(dataString) {
  var header = dataString.substring(0,30);
  var end = header.indexOf(";base64,");
  var start = "data:image/".length;
  return '.' + header.substring(start, end);
}

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function saveImageSync(base64Data) {
  var start = randomInt(35, 40);
  var end = randomInt(50, 55);
  var chunk = base64Data.substring(start, end);

  var md5sum = crypto.createHash('md5');
  var hashStr = md5sum.update(chunk).digest('hex');

  var imageBuffer = decodeBase64Image(base64Data);
  var filetype = getImageContainer(base64Data);
  var filename = img_file_prefix + Date.now() + hashStr + filetype;
  var filepath = __dirname + img_write_path + filename;
  fs.writeFileSync(filepath, imageBuffer.data);
  var url = http_protocol + server_address + img_access_path + filename;
  return url; 
}

module.exports = router;
