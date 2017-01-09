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


// t = reserv_time - Date.now()
// [time interval] => (rest_percentage, user_percentage, commission_percentage)
// 0 hour <= t < 1 hour --> (100%, 0%, 0%)
// 1 hour <= t < 2 hour --> (80%, 15%, 5%)
// 2 hour <= t < 3 hour --> (60%, 35%, 5%)
// 3 hour <= t < 4 hour --> (40%, 55%, 5%)
// 4 hour <= t < 6 hour --> (20%, 75%, 5%)
// 6 hour <= t          --> (0%, 100%, 0%)
const LT_ONE_HOUR_REST = 100;
const LT_ONE_HOUR_COMM = 0;
const LT_ONE_HOUR_USER = 100 - LT_ONE_HOUR_REST - LT_ONE_HOUR_COMM; // 0

const LT_TWO_HOUR_REST = 80;
const LT_TWO_HOUR_COMM = 5;
const LT_TWO_HOUR_USER = 100 - LT_TWO_HOUR_REST - LT_TWO_HOUR_COMM; // 15

const LT_THREE_HOUR_REST = 60;
const LT_THREE_HOUR_COMM = 5;
const LT_THREE_HOUR_USER = 100 - LT_THREE_HOUR_REST - LT_THREE_HOUR_COMM; // 35

const LT_FOUR_HOUR_REST = 40;
const LT_FOUR_HOUR_COMM = 5;
const LT_FOUR_HOUR_USER = 100 - LT_FOUR_HOUR_REST - LT_FOUR_HOUR_COMM; // 55

const LT_SIX_HOUR_REST = 20;
const LT_SIX_HOUR_COMM = 5;
const LT_SIX_HOUR_USER = 100 - LT_SIX_HOUR_REST - LT_SIX_HOUR_COMM; // 75

const GTE_SIX_HOUR_REST = 0;
const GTE_SIX_HOUR_COMM = 0;
const GTE_SIX_HOUR_USER = 100 - LT_SIX_HOUR_REST - LT_SIX_HOUR_COMM; // 100

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
 *  GET_REST_PHOTOS: type, rest_id => result, photos[]
 *
 *  GET_RESERV_LIST: type, user_id || rest_id => status_msg, status_res,
 *    rest_name || user_name, reserv_time, send_time, checked_time, respond_time, 
 *    reserv_fee, request, people
 *  
 *  MAKE_RESERV: type, user_id, user_name, reserv_time, user_phone, ...
 *
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
          res.json({result:'success', description:'updated user pic', url:url});
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
      if (!json.rest_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id not found'});
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
          res.json({result:'success', description:'updated restaurant pic', url:url});
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

    case 'GET_REST_PHOTOS':
      if (!json.rest_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id not found'});
        return;
      }
      query = 'SELECT photo FROM photos WHERE rest_id = ?';
      connection.query(query, json.rest_id, function(err, rows, fields) {
        if (err) {
          connection.release();
          return next(err);
        }
        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'rest_id not exists'});
          return;
        }
        var results = {result:'success', photos:rows};
        connection.release();
        res.json(results);
        return;
      });
      break;

    case 'GET_RESERV_LIST':
      if (!json.user_id && !json.rest_id) {
        connection.release();
        res.json({result:'failed', description:'user_id or rest_id not found'});
        return;
      }
      if (json.user_id) {
        // USER'S REQUEST
        query = 'SELECT id, status_msg, status_res, rest_name, rest_phone, reserv_time, send_time, checked_time, respond_time, reserv_fee, request, people FROM reservations WHERE user_id = ?';
        connection.query(query, [json.user_id], function (err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          var results = {result:'success', reservations:rows};
          connection.release();
          res.json(results);
        });
      } else {
        // RESTAURANT'S REQUEST
        query = 'SELECT id, status_msg, status_res, user_name, rest_phone, reserv_time, send_time, checked_time, respond_time, reserv_fee, request, people FROM reservations WHERE rest_id = ?';
        connection.query(query, [json.rest_id], function (err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          var results = {result:'success', reservations:rows};
          connection.release();
          res.json(results);
        });
      }
      break;

    case 'GET_ACCEPTED_RESERV_LIST':
      if (!json.user_id && !json.rest_id) {
        connection.release();
        res.json({result:'failed', description:'user_id or rest_id not found'});
        return;
      }
      if (json.user_id) {
        // USER'S REQUEST
        query = 'SELECT id, status_msg, status_res, rest_name, rest_phone, reserv_time, send_time, checked_time, respond_time, reserv_fee, request, people FROM reservations WHERE status_msg = ? AND user_id = ?';
        connection.query(query, ['ACCEPTED', json.user_id], function (err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          var results = {result:'success', reservations:rows};
          connection.release();
          res.json(results);
        });
      } else {
        // RESTAURANT'S REQUEST
        query = 'SELECT id, status_msg, status_res, user_name, rest_phone, reserv_time, send_time, checked_time, respond_time, reserv_fee, request, people FROM reservations WHERE status_msg = ? AND rest_id = ?';
        connection.query(query, ['ACCEPTED', json.rest_id], function (err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          var results = {result:'success', reservations:rows};
          connection.release();
          res.json(results);
        });
      }
      break;

    case 'GET_NOT_ACCEPTED_RESERV_LIST':
      if (!json.user_id && !json.rest_id) {
        connection.release();
        res.json({result:'failed', description:'user_id or rest_id not found'});
        return;
      }
      if (json.user_id) {
        // USER'S REQUEST
        query = 'SELECT id, status_msg, status_res, rest_name, rest_phone, reserv_time, send_time, checked_time, respond_time, reserv_fee, request, people FROM reservations WHERE NOT status_msg = ? AND user_id = ?';
        connection.query(query, ['ACCEPTED', json.user_id], function (err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          var results = {result:'success', reservations:rows};
          connection.release();
          res.json(results);
        });
      } else {
        // RESTAURANT'S REQUEST
        query = 'SELECT id, status_msg, status_res, user_name, rest_phone, reserv_time, send_time, checked_time, respond_time, reserv_fee, request, people FROM reservations WHERE NOT status_msg = ? AND rest_id = ?';
        connection.query(query, ['ACCEPTED', json.rest_id], function (err, rows, fields) {
          if (err) {
            connection.release();
            return next(err);
          }
          var results = {result:'success', reservations:rows};
          connection.release();
          res.json(results);
        });
      }
      break;

    case 'MAKE_RESERVATION':

      // query = 'SELECT token FROM restaurants WHERE id = ?'
      // connection.query(query, json.rest_id, function (err, rows, fields) {
      //     if (err) {
      //       connection.release();
      //       return next(err);
      //     }
      //     var token = rows[0].token;
      //     var message = {
      //       to: token,
      //       data: {
      //         user_name: json.user_name,
      //         people: json.people,
      //         reserv_time: json.reserv_time,
      //         request: json.request,
      //         reserv_fee: json.reserv_fee,
      //         user_phone: json.use_phone
      //       },
      //       notification: {
      //         title: '새로운 예약 접수 알림',
      //         body: json.user_name + "님이 " + json.reserv_time + "에 " + json.people + "명 예약을 접수했습니다."
      //       }
      //     };

      //     fcm.send(message, function(err, response){
      //         if (err) {
      //           console.log(err);
      //           console.log('Something has gone wrong!');
      //         } else {
      //           console.log('Successfully sent with response:', reponse);
      //         }
      //     });

      // });

      // IF NOT EXISTS, CREATE AN RESERVATION WITH USER_ID, USER_NAME, REST_ID, REST_NAME, RESERV_TIME, USER_PHONE, SEND_TIME(IN SERVER),
      // RESERV_FEE, REQUEST, PEOPLE (OTHERS DEFAULT VALUE: ID, STATUS_MSG, STATUS_RES, CHECKED_TIME, RESPOND_TIME)
      query = 'INSERT INTO reservations (user_id, user_name, rest_id, rest_name, rest_phone, reserv_time, user_phone, send_time, reserv_fee, request, people) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      connection.query(query, [json.user_id, json.user_name, json.rest_id, json.rest_name, json.rest_phone, json.reserv_time, json.user_phone, getLocalTime(), json.reserv_fee, json.request, json.people], function(err, rows, fields) {
        if (err) {
          console.log(err);
          connection.release();
          return next(err);
        }

        query = 'UPDATE users SET coin = coin - ? WHERE id = ?';
        connection.query(query, [Number(json.reserv_fee), json.user_id], function (err, rows, fields) {
          if (err) {
            console.log(err);
            connection.release();
            return next(err);
          }

          connection.release();
          var msg = '예약금 ' + Number(json.reserv_fee) + '원으로 예약했습니다.'
          res.json({result:'success', description:msg});
          return;
        });
      });
      break;

    case 'CANCEL_RESERV':
      if (!json.user_id || !json.reserv_id) {
        connection.release();
        res.json({result:'failed', description:'user_id or reserv_id not found'});
        return;
      }
      // NOT_READ_YET, CHECKED => CANCELABLE with NO PENALTY
      // ACCEPTED => CANCELABLE with PENALTY
      // DECLINED => NOT CANCELABLE
      query = 'SELECT rest_id, status_msg, reserv_time, reserv_fee FROM reservations WHERE id = ? AND user_id = ?';
      connection.query(query, [json.reserv_id, json.user_id], function (err, rows, fields) {
        console.log(json.reserv_id, json.user_id);
        if (err) {
          console.log(err);
          connection.release();
          return next(err);
        }

        if (isEmpty(rows)) {
          connection.release();
          res.json({result:'failed', description:'reservation not exists'});
          return;
        }

        console.log(rows);
        var rest_id = rows[0].rest_id;
        var status_msg = rows[0].status_msg;
        var reserv_time = rows[0].reserv_time;
        var reserv_fee = Number(rows[0].reserv_fee);

        if (status_msg == 'NOT_READ_YET' || status_msg == 'CHECKED') {
          query = 'DELETE FROM reservations WHERE id = ? AND user_id = ?';
          connection.query(query, [json.reserv_id, json.user_id], function (err, rows, fields) {
            if (err) {
              console.log(err);
              connection.release();
              return next(err);
            }
            
            // PUSH ALARM to RESTAURANT

            // REFUND TO USER
            query = 'UPDATE users SET coin = coin + ? WHERE id = ?';
            connection.query(query, [reserv_fee, json.user_id], function (err, rows, fields) {
              if (err) {
                console.log(err);
                connection.release();
                return next(err);
              }

              connection.release();
              var msg = '예약금 전액 ' + reserv_fee + '원을 환불받았습니다.'
              res.json({result:'success', description:msg});
              return;
            });
          });
        } else if (status_msg == 'DECLINED') {
          connection.release();
          res.json({result:'failed', description:'you can\'t cancel declined reservation'});
          return;
        } else if (status_msg == 'ACCEPTED') {
          var refund_to_rest = 0;
          var refund_to_user = 100;

          switch (calculateLaxityTime(reserv_time)) {
            case -1:
              connection.release();
              res.json({result:'failed', description:'error on calculateLaxityTime()'});
              return;
              break;
            
            case 1:
              refund_to_rest = getCoinByPercentage(reserv_fee, LT_ONE_HOUR_REST);
              refund_to_user = getCoinByPercentage(reserv_fee, LT_ONE_HOUR_USER);
              break;

            case 2:
              refund_to_rest = getCoinByPercentage(reserv_fee, LT_TWO_HOUR_REST);
              refund_to_user = getCoinByPercentage(reserv_fee, LT_TWO_HOUR_USER);
              break;

            case 3:
              refund_to_rest = getCoinByPercentage(reserv_fee, LT_THREE_HOUR_REST);
              refund_to_user = getCoinByPercentage(reserv_fee, LT_THREE_HOUR_USER);
              break;

            case 4:
              refund_to_rest = getCoinByPercentage(reserv_fee, LT_FOUR_HOUR_REST);
              refund_to_user = getCoinByPercentage(reserv_fee, LT_FOUR_HOUR_USER);
              break;

            case 6:
              refund_to_rest = getCoinByPercentage(reserv_fee, LT_SIX_HOUR_REST);
              refund_to_user = getCoinByPercentage(reserv_fee, LT_SIX_HOUR_USER);
              break;

            case 10:
              refund_to_rest = getCoinByPercentage(reserv_fee, GTE_SIX_HOUR_REST);
              refund_to_user = getCoinByPercentage(reserv_fee, GTE_SIX_HOUR_USER);
              break;
            
            default:
              break;
          }
          query = 'DELETE FROM reservations WHERE id = ? AND user_id = ?';
          connection.query(query, [json.reserv_id, json.user_id], function (err, rows, fields) {
            if (err) return next(err);
            
            // PUSH ALARM to RESTAURANT

            // REFUND TO USER
            query = 'UPDATE users SET coin = coin + ? WHERE id = ?';
            connection.query(query, [refund_to_user, json.user_id], function (err, rows, fields) {
              if (err) return next(err);

              // REFUND TO RESTAURANT
              query = 'UPDATE restaurants SET coin = coin + ? WHERE id = ?';
              connection.query(query, [refund_to_rest, rest_id], function (err, rows, fields) {
                if (err) return next(err);

                connection.release();
                var msg = '예약금 총' + reserv_fee + '원 중, ' + refund_to_user + '원을 환불받았습니다.'
                res.json({result:'success', description:msg});
                return;
              });
            });
          });

        } else {
          connection.release();
          res.json({result:'failed', description:'invalid status6_msg'});
          return;
        }
      });
      break;

    // 서버에서 계속 돌아가야 하는 것
    // 예약시간과 현재시간 체크해서 상태 업데이트 및 알람
    // 예약시간 1시간 전 푸쉬 알람
    // 예약시간 지나면 자동으로 DECLINE
    // ...

    case 'CHECK_RESERV':
      // UPDATE RESERVATION'S STATUS_MSG, CHECKED_TIME
      if (!json.rest_id || !json.reserv_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id or reserv_id not found'});
        return;
      }
      query = 'UPDATE reservations SET status_msg = ?, checked_time = ? WHERE id = ? AND rest_id = ?';
      connection.query(query, ['CHECKED', getLocalTime(), json.reserv_id, json.rest_id], function (err, rows, fields) {
        if (err) return next(err);
        connection.release();
        res.json({result:'success', description:'checked reservation'});
        return;
      });
      break;

    case 'ACCEPT_RESERV':
      // PUSH ALARM TO USER
      // UPDATE RESERVATION'S STATUS_MSG, RESPOND_TIME
      if (!json.rest_id || !json.reserv_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id or reserv_id not found'});
        return;
      }
      query = 'UPDATE reservations SET status_msg = ?, respond_time = ? WHERE id = ? AND rest_id = ?';
      connection.query(query, ['ACCEPTED', getLocalTime(), json.reserv_id, json.rest_id], function (err, rows, fields) {
        if (err) return next(err);
        connection.release();
        res.json({result:'success', description:'accepted reservation'});
        return;
      });
      break;

    case 'DECLINE_RESERV':
      // 100% REFUND TO USER => PUSH ALARM TO USER
      // UPDATE RESERVATION'S STATUS_MSG, RESPOND_TIME
      if (!json.rest_id || !json.reserv_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id or reserv_id not found'});
        return;
      }
      query = 'UPDATE reservations SET status_msg = ?, respond_time = ? WHERE id = ? AND rest_id = ?';
      connection.query(query, ['DECLINED', getLocalTime(), json.reserv_id, json.rest_id], function (err, rows, fields) {
        if (err) {
          console.log(err);
          connection.release();
          return next(err);
        }
        query = 'SELECT user_id FROM reservations WHERE id = ? AND rest_id = ?';
        connection.query(query, [json.reserv_id, json.rest_id], function (err, rows, fields) {
          if (err) {
            console.log(err);
            connection.release();
            return next(err);
          }
          var user_id = rows[0].id;

          query = 'SELECT reserv_fee FROM reservations WHERE id = ? AND rest_id = ?';
          connection.query(query, [json.reserv_id, json.rest_id], function (err, rows, fields) {
            if (err) {
              console.log(err);
              connection.release();
              return next(err);
            }
            var refund_to_user = rows[0].reserv_fee;

            query = 'UPDATE users SET coin = coin + ? WHERE id = ?';
            connection.query(query, [refund_to_user, user_id], function (err, rows, fields) {
              if (err) {
                console.log(err);
                connection.release();
                return next(err);
              }
              connection.release();
              res.json({result:'success', description:'declined reservation'});
              return;
            });
          });
        });
      });
      break;

    case 'RESULT_SHOWED':
      // 100% REFUND TO USER => PUSH ALARM TO USER
      // UPDATE RESERVATION'S STATUS_RES
      // UPDATE USER'S NO_SHOW_INDEX(?)
      if (!json.rest_id || !json.reserv_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id or reserv_id not found'});
        return;
      }
      query = 'UPDATE reservations SET status_res = ? WHERE id = ? AND rest_id = ?';
      connection.query(query, ['SHOWED', json.reserv_id, json.rest_id], function (err, rows, fields) {
        if (err) {
          console.log(err);
          connection.release();
          return next(err);
        }

        query = 'SELECT user_id FROM reservations WHERE id = ? AND rest_id = ?';
        connection.query(query, [json.reserv_id, json.rest_id], function (err, rows, fields) {
          if (err) {
            console.log(err);
            connection.release();
            return next(err);
          }
          var user_id = rows[0].id;

          query = 'SELECT reserv_fee FROM reservations WHERE id = ? AND rest_id = ?';
          connection.query(query, [json.reserv_id, json.rest_id], function (err, rows, fields) {
            if (err) {
              console.log(err);
              connection.release();
              return next(err);
            }
            var refund_to_user = rows[0].reserv_fee;

            query = 'UPDATE users SET coin = coin + ? WHERE id = ?';
            connection.query(query, [refund_to_user, user_id], function (err, rows, fields) {
              if (err) {
                console.log(err);
                connection.release();
                return next(err);
              }
              connection.release();
              var msg = '손님에게 예약금 ' + refund_to_user + '원 전액을 환급했습니다.';
              res.json({result:'success', description:msg});
              return;
            });
          });
        });
      });
      break;

    case 'RESULT_NOT_SHOWED':
      // 100% REFUND TO RESTAURANT => PUSH ALARM TO USER
      // UPDATE RESERVATION'S STATUS RES
      // UPDATE USER'S NO_SHOW_INDEX(?)
      if (!json.rest_id || !json.reserv_id) {
        connection.release();
        res.json({result:'failed', description:'rest_id or reserv_id not found'});
        return;
      }
      query = 'UPDATE reservations SET status_res = ? WHERE id = ? AND rest_id = ?';
      connection.query(query, ['NOT_SHOWED', json.reserv_id, json.rest_id], function (err, rows, fields) {
        if (err) {
          console.log(err);
          connection.release();
          return next(err);
        }

        query = 'SELECT reserv_fee FROM reservations WHERE id = ? AND rest_id = ?';
        connection.query(query, [json.reserv_id, json.rest_id], function (err, rows, fields) {
          if (err) {
            console.log(err);
            connection.release();
            return next(err);
          }
          var refund_to_restaurant = rows[0].reserv_fee;

          query = 'UPDATE restaurants SET coin = coin + ? WHERE id = ?';
          connection.query(query, [refund_to_restaurant, json.rest_id], function (err, rows, fields) {
            if (err) {
              console.log(err);
              connection.release();
              return next(err);
            }
            connection.release();
            var msg = '손님이 설정한 예약금 ' + refund_to_restaurant + '원을 지급받았습니다.'
            res.json({result:'success', description:msg});
            return;
          });
        });
      });
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

function calculateLaxityTime(reserv_time) {
  var now = new Date(getLocalTime()).getTime();
  var res = new Date(reserv_time).getTime();
  var t = res - now;
  if (t < 1 * 3600 * 1000) {
    return 1;
  } else if (t < 2 * 3600 * 1000) {
    return 2;
  } else if (t < 3 * 3600 * 1000) {
    return 3;
  } else if (t < 4 * 3600 * 1000) {
    return 4;
  } else if (t < 6 * 3600 * 1000) {
    return 6;
  } else if (6 * 3600 * 1000 <= t) {
    return 10
  } else {
    return -1;
  }
}

function getCoinByPercentage(coin, percentage) {
  return Math.ceil(coin * percentage / 100.0)
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

function saveImageSync(base64Data, callback) {
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
