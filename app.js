const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');
const app = express();

require('dotenv').config();

app.use('/', express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({extended: false}));

const port = process.env.PORT || 3000;

// DB Stuffers
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
});

// Schema
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String, 
        required: true, 
        index: { unique: true } 
    },
    _id: {
        type: String, 
        required: true
    },
    count: Number,
    log: [{
      __v: false,
      _id: false,
      description: String,
      duration: Number,
      date: { type: Date, default: Date.now }
    }]
  });
  
  const User = mongoose.model('User', userSchema);

// Endpoints
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
})

//Add new user
app.post('/api/exercise/new-user', (req, res, next) => {
  const new_user = req.body.username;
  if(new_user) {
    User.findOne({username: new_user}, function(err, data) {
      if(err) next(err);
      if(data) {
        next({status: 400, message: 'username already exists'});
      } else {
        let user = new User({ username: new_user, _id: shortid.generate() });
        user.save(function(err, data) {
          if(err) next(err);
          res.json({ username: data.username, _id: data._id });
        });
      }
    });
  } else {
    next({status: 400, message: 'no username given'});
  }
})

app.get('/api/exercise/users', (req, res, next) => {
    var projections = { log: false };
    User.find({}, projections, function(err, data) {
      if(err) next(err);
      res.json(data);
    });
  })

// Add new exercise
app.post('/api/exercise/add', (req, res, next) => {
    let user_id = req.body.userId,
        description = req.body.description,
        duration = req.body.duration,
        date = req.body.date ? new Date(req.body.date) : new Date()
    
    if(req.body.userId) {
      User.findOne({_id: user_id}, function(err, data) {
        if(err) next(err);
          if(!data || data._id !== user_id) {
            next({status: 400, message: 'no valid ID exists'});
          } else {
            User.findByIdAndUpdate({_id: user_id},
                        {$push: {log: {description, duration, date}} },
                        {upsert: true, new: true},
                        function(err, data) {
              if(err) next(err);
              if(!data) { next({status: 400, message: 'no valid ID exits'}) }
              else { res.json({
                username: data.username,
                _id: data._id,
                description,
                duration, 
                date : date.toDateString()
              }) }
            });
          }
      });
    } else { next({status: 400, message: 'no ID given' })}
    
    if(!description) {next({status: 400, message: 'missing description'})}
    if(!duration) {next({status: 400, message: 'missing duration'})}
  })

// Get logs of users
 app.get('/api/exercise/log?{userid}', (req, res, next) => {
    User.findOne({_id: req.query.userId}, function(err, user) {
      if(err) return next(err);
      if(!user) {
        next({status:400, message: 'incorrect ID given'});
      } else {
        let limit = req.query.limit,
            exercise = user.log,
            from = req.query.from ? new Date(req.query.from) : new Date('1970-01-01'),
            to = req.query.to ? new Date(req.query.to): new Date();
        
        // filter through date range
        exercise = exercise.filter(data => (data.date >= from && data.date <= to));
                            //sort dates from newest to oldest
        exercise = exercise.sort((first, second) => first.date < second.date) 
                            //format date
                           .map(item => ({
                              description: item.description,
                              duration: item.duration,
                              date: item.date.toDateString()
                            }));
        
        if(!isNaN(limit) && exercise.length >= limit) {
          exercise = exercise.slice(0, limit);
        }
                
        res.json({
          username: user.username,
          _id: user._id,
          from: req.query.from ? new Date(req.query.from).toDateString() : undefined,
          to: req.query.to ? new Date(req.query.to).toDateString() : undefined,
          count: exercise.length,
          log: exercise
        });
        
      }
      
    });
  })

  app.use((err, req, res, next) => {
    let errCode, errMessage
  
    if (err.errors) {
      // mongoose validation error
      errCode = 400 // bad request
      const keys = Object.keys(err.errors)
      // report the first validation error
      errMessage = err.errors[keys[0]].message
    } else {
      // generic or custom error
      errCode = err.status || 500
      errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
      .send(errMessage)
  });

app.listen(port, () => {
        console.log(`You're on port ${port}`);
})
