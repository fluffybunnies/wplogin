
var maxWait = 10000
,dflt = -200
,index = 0
,port = 3000
,currentWorL
;
require('http').createServer(function(req,res){
	var reqWorL = getWinOrLoseFromRequest(req.url);
	if (reqWorL != currentWorL) {
		currentWorL = reqWorL;
		if (currentWorL >= 0)
			console.log('Will find match on attempt '+currentWorL);
		else
			console.log('Will fail on attempt '+currentWorL);
	}

	if (currentWorL == index) {
		// correct password...
		console.log('Supplying correct password...');
		r(302,'Found','yay!');
	} else if (currentWorL == -index) {
		// block requests...
		console.log('Blocking requests...');
		r(403,'Forbidden','sorry...');
	} else {
		// wrong password...
		res.end(Array(400).join('sup'));
	}
	/*else if (index === 0)
		setTimeout(function(){
			r(404,'Whered it go?');
		},maxWait);*/
	++index;
	function r(a,b,c){
		index = 0;
		res.writeHeader(a,b);
		res.end(['',c,currentWorL,''].join('\n'));
	}
}).listen(port);

console.log('Listening on port '+port);
//console.log(['maxWait: '+maxWait, 'dflt: '+dflt, '\n'].join('\n'));

function getWinOrLoseFromRequest(url) {
	var worl = url.match(/-?[0-9]+/);
	return worl ? worl[0] : dflt;
}
