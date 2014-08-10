var test = require('tape')
,level = require('../level')
;

test('levs',function(t){
	level.saveResult('www.google.com','ralph','password',1,function(err,data){
		level.saveResult('www.google.com','ralph','password2',0,function(err,data){
			level.getResultsForHostUser('www.google.com','ralph',function(err,data){
				console.log(err,data);
				t.equal(data.length, 2, 'level worky')
				t.end();
			});
		});
	});
});
