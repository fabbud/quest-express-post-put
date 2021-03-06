// dotenv loads parameters (port and database config) from .env
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connection = require('./db');
const { check, validationResult } = require('express-validator');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  );
  res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
  next();
});

// respond to requests on `/api/users`
app.get('/api/users', (req, res) => {
  // send an SQL query to get all users
  connection.query('SELECT * FROM user', (err, results) => {
    if (err) {
      // If an error has occurred, then the client is informed of the error
      res.status(500).json({
        error: err.message,
        sql: err.sql,
      });
    } else {
      // If everything went well, we send the result of the SQL query as JSON
      res.json(results);
    }
  });
});

const userValidationMiddlewares = [
  // email must be valid
  check('email').isEmail(),
  // password must be at least 8 chars long
  check('password').isLength({ min: 8 }),
  // let's assume a name should be 2 chars long
  check('name').isLength({ min: 2 }),
];

app.post('/api/users', userValidationMiddlewares, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  connection.query('INSERT INTO user SET ?', req.body, (err, results) => {
    if (err) {
      // MySQL reports a duplicate entry -> 409 Conflict
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Email already exists',
        });
      } else {
        // Other error codes -> 500
        return res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
    } else {
      // Show updated user information
      return connection.query(
        'SELECT * FROM user WHERE id = ?',
        results.insertId,
        (err2, records) => {
          if (err2) {
            return res.status(500).json({
              error: err2.message,
              sql: err2.sql,
            });
          }
          const insertedUser = records[0];
          const { password, ...user } = insertedUser;
          const host = req.get('host');
          const location = `http://${host}${req.url}/${user.id}`;
          return res.status(200).set('Location', location).json(user);
        },
      );
    }
  });
});

app.put('/api/users/:id', userValidationMiddlewares, (req, res) => {
  const { id } = req.params;
  const formData = req.body;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  connection.query(
    'UPDATE user SET ? WHERE id = ?',
    [formData, id],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
      // Show updated user information
      return connection.query(
        'SELECT * FROM user WHERE id = ?',
        id,
        (err2, records) => {
          if (err2) {
            return res.status(500).json({
              error: err2.message,
              sql: err2.sql,
            });
          }
          const insertedUser = records[0];
          const { password, ...user } = insertedUser;
          // const user = { name: 'winston', email: 'winston@gmail.com', id: 1}
          const host = req.get('host'); // localhost:3000 / mywebsite.com
          const location = `http://${host}${req.url}/${user.id}`;
          // req.url = /api/users/1
          return res.status(200).set('Location', location).json(user);
        },
      );
    },
  );
});

app.listen(process.env.PORT, (err) => {
  if (err) {
    throw new Error('Something bad happened...');
  }

  console.log(`Server is listening on ${process.env.PORT}`);
});
