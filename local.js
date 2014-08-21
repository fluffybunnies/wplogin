
var maxWait = 10000
,dflt = -200
,index = 0
,winOrLose
;
require('http').createServer(function(req,res){
	if (!index)
		winOrLose = (winOrLose=(req.url.match(/-?[0-9]+/)) || dflt) ? winOrLose : dflt;
	if (winOrLose == index)
		r(302,'Found','yay!');
	else if (winOrLose == -index)
		r(403,'Forbidden','sorry...');
	else if (index === 0)
		setTimeout(function(){
			r(404,'Whered it go?');
		},maxWait);
	++index;
	function r(a,b,c){
		index = 0;
		res.writeHeader(a,b);
		res.end(['',c,winOrLose,''].join('\n'));
	}
}).listen(3000);