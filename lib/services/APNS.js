var fs = require('fs') ;
var _ = require('underscore') ;
var format = require('util').format ;
var util = require('util') ;
var AbstractService = require('./Abstract') ;
var apn = require('apn') ;
var apnErrors = require('apn/lib/errors');
var apnErrorMap = _.invert(apnErrors);
var EventEmitter = require('events').EventEmitter ;
var pushmqErrorMap = {
	1: 'TransmissionError',
	2: 'TokenInvalid',
	3: 'PayloadInvalid',
	4: 'PayloadInvalid',
	5: 'TokenInvalid',
	6: 'PayloadInvalid',
	7: 'PayloadInvalid',
	8: 'TokenInvalid',
	10: 'TransmissionError',
	512: 'TransmissionError',
	513: 'TransmissionError'
};

module.exports = APNS ;

util.inherits( APNS , AbstractService ) ;

function APNS ( config ) {
	
	var self = this;
	
	AbstractService.apply(self,arguments);
	
	self._connection = new apn.Connection( config ) ;
	
	self.receipts = new EventEmitter();
	
	self._connection.on('transmissionError',function(errorCode,m){
		if (m&&m._id) {
			var attemptEvt = format('attempted:%s',m._id);
			var errEvt = format('failed:%s',m._id);			
			self.receipts.emit( attemptEvt );
			self.receipts.emit( errEvt, pushmqErrorMap[errorCode], apnErrorMap[errorCode] );
		}
	});
	self._connection.on('transmitted',function(m){
		if (m&&m._id) {
			var attemptEvt = format('attempted:%s',m._id);
			self.receipts.emit( attemptEvt );
		}
	});
	self._connection.on('acknowledged',function(m){
		if (m&&m._id) {
			var ackEvt = format('acknowledged:%s',m._id);
			self.receipts.emit( ackEvt );
		}
	});
	
};

APNS.prototype.send = function ( id, data ) {
	
	var self = this ;
	var msgJson = _.extend({},data.payload,{ aps : data.aps });
	var notification = _.extend( new apn.Notification( msgJson ) , { 
		mdm : data.mdm ,
		expiry : data.expiry ,
		priority : data.priority ,
		_id : id
	});
	var attemptEvt = format('attempted:%s',id);
	var errEvt = format('failed:%s',id);
	var device;
	
	try {
		device = new apn.Device( data.token );
	} catch (e) {
		return self.receipts.emit( errEvt, 'TokenUnparseable' );
	}
	
	self._connection.pushNotification( notification , device );
	
};
