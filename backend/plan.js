var express = require('express');
var app = express();
var path = require('path');
app.get('/', function(req, res) {
	  res.sendFile(path.join(__dirname+'/../frontend/a.html'));
	  });
app.get('/scopes/jia', function(req, res) {
	  res.send('Hello I am Jia\n');
	  });
app.get('/scopes/json', function(req, res) {
	  res.sendFile(path.join(__dirname+'/hello.json'));
	  });
app.listen(8080);
console.log('Listening on port 8080...');
