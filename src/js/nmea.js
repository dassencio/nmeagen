/** NMEA public API */
var nmea = {};

/** private module variables */
var m_parserList = [];
var m_encoderList = [];
var m_errorHandler = null;
var m_latitudePrecision	= 3;
var m_longitudePrecision = 3;
var m_hex = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];

// =============================================
// public API functions
// =============================================
nmea.toHexString = function(v) {
	var lsn;
	var msn;

	msn = (v >> 4) & 0x0f;
	lsn = (v >> 0) & 0x0f;
	return m_hex[msn] + m_hex[lsn];
};

nmea.padLeft = function(s, len, ch) {
	while(s.length < len) {
		s = ch + s;
	}
	return s;
};

// verify the checksum
nmea.verifyChecksum = function(sentence, checksum) {
	var q;
	var c1;
	var c2;
	var i;

	// skip the $
	i = 1;

	// init to first character
	c1 = sentence.charCodeAt(i);

	// process rest of characters, zero delimited
	for( i = 2; i < sentence.length; ++i) {
		c1 = c1 ^ sentence.charCodeAt(i);
	}

	// checksum is a 2 digit hex value
	c2 = parseInt(checksum, 16);

	// should be equal
	return ((c1 & 0xff) === c2);
};

// generate a checksum for	a sentence (no trailing *xx)
nmea.computeChecksum = function(sentence) {
	var c1;
	var i;

	// skip the $
	i = 1;

	// init to first character var count;

	c1 = sentence.charCodeAt(i);

	// process rest of characters, zero delimited
	for( i = 2; i < sentence.length; ++i) {
		c1 = c1 ^ sentence.charCodeAt(i);
	}

	return '*' + nmea.toHexString(c1);
};

/** set the number of decimal digits in an encoded latitude value */
nmea.setLatitudePrecision = function(precision) {
	m_latitudePrecision = precision;
};

nmea.getLatitudePrecision = function() {
	return m_latitudePrecision;
};

nmea.setLongitudePrecision = function(precision) {
	m_longitudePrecision = precision;
};

nmea.getLongitudePrecision = function() {
	return m_longitudePrecision;
};

// function to add parsers
nmea.addParser = function(sentenceParser) {
	if(sentenceParser == null) {
		this.error('invalid sentence parser : null');
		return;
	}
	m_parserList.push(sentenceParser);
};

/** function to add encoders */
nmea.addEncoder = function(sentenceEncoder) {
	if(sentenceEncoder == null) {
		this.error('invalid	sentence encoder : null');
		return;
	}
	m_encoderList.push(sentenceEncoder);
};

// =========================================
// field encoders
// =========================================

// encode latitude
// input: latitude in decimal degrees
// output: latitude in nmea format
// ddmm.mmm
// nmea.m_latitudePrecision = 3;
nmea.encodeLatitude = function(lat) {
	var d;
	var m;
	var f;
	var h;
	var s;
	var t;

	if(lat < 0) {
		h = 'S';
		lat = -lat;
	} else {
		h = 'N';
	}
	// get integer degrees
	d = Math.floor(lat);
	// degrees are always 2 digits
	s = d.toString();
	if(s.length < 2) {
		s = '0' + s;
	}
	// get fractional degrees
	f = lat - d;
	// convert to fractional minutes
	m = (f * 60.0);
	// format the fixed point fractional minutes
	t = m.toFixed(m_latitudePrecision);
	if(m < 10) {
		// add leading 0
		t = '0' + t;
	}

	s = s + t + ',' + h;
	return s;
};

// encode longitude
// input: longitude in decimal degrees
// output: longitude in nmea format
// dddmm.mmm
// nmea.m_longitudePrecision = 3;
nmea.encodeLongitude = function(lon) {
	var d;
	var m;
	var f;
	var h;
	var s;
	var t;

	if(lon < 0) {
		h = 'W';
		lon = -lon;
	} else {
		h = 'E';
	}

	// get integer degrees
	d = Math.floor(lon);
	// degrees are always 3 digits
	s = d.toString();
	while(s.length < 3) {
		s = '0' + s;
	}

	// get fractional degrees
	f = lon - d;
	// convert to fractional minutes and round up to the specified precision
	m = (f * 60.0);
	// minutes are always 6 characters = mm.mmm
	t = m.toFixed(m_longitudePrecision);
	if(m < 10) {
		// add leading 0
		t = '0' + t;
	}
	s = s + t + ',' + h;
	return s;
};

// 1 decimal, always meters
nmea.encodeAltitude = function(alt = null) {
	if(alt == null) {
		return ',M';
	}
	return alt.toFixed(1) + ',M';
};

// magnetic variation
nmea.encodeMagVar = function(v = null) {
	var a;
	var s;
	if(v == null) {
		return ',';
	}
	a = Math.abs(v);
	s = (v < 0) ? (a.toFixed(1) + ',E') : (a.toFixed(1) + ',W');
	return nmea.padLeft(s, 7, '0');
};

// degrees
nmea.encodeDegrees = function(d = null) {
	if(d === null) {
		return '';
	}
	return nmea.padLeft(d.toFixed(1), 5, '0');
};

nmea.encodeDate = function(d) {
	var yr;
	var mn;
	var dy;

	yr = d.getUTCFullYear();
	mn = d.getUTCMonth() + 1;
	dy = d.getUTCDate();

	return nmea.padLeft(dy.toString(), 2, '0') + nmea.padLeft(mn.toString(), 2, '0') + yr.toString().substr(2);
};

nmea.encodeTime = function(d) {
	var h;
	var m;
	var s;
	var ms;

	h = d.getUTCHours();
	m = d.getUTCMinutes();
	s = d.getUTCSeconds();
	ms = d.getUTCMilliseconds();

	return nmea.padLeft(h.toString(), 2, '0') +
	       nmea.padLeft(m.toString(), 2, '0') +
	       nmea.padLeft(s.toString(), 2, '0') + '.' +
	       nmea.padLeft(ms.toString(), 3, '0');
};

nmea.encodeKnots = function(k = null) {
	if(k == null) {
		return '';
	}
	return nmea.padLeft(k.toFixed(1), 5, '0');
};

nmea.encodeValue = function(v = null) {
	if(v == null) {
		return '';
	}
	return v.toString();
};

nmea.encodeFixed = function(v = null, f) {
	if(v == null) {
		return '';
	}
	return v.toFixed(f);
};

// =========================================
// field parsers
// =========================================

// separate number and units
nmea.parseAltitude = function(alt, units) {
	var scale = 1.0;
	if(units === 'F') {
		scale = 0.3048;
	}
	return parseFloat(alt) * scale;
};

// separate degrees value and quadrant (E/W)
nmea.parseDegrees = function(deg, quadrant) {
	var q = (quadrant === 'E') ? -1.0 : 1.0;

	return parseFloat(deg) * q;
};

// fields can be empty so have to wrap the global parseFloat
nmea.parseFloatX = function(f) {
	if(f === '') {
		return 0.0;
	}
	return parseFloat(f);
};

// decode latitude
// input : latitude in nmea format
//			first two digits are degress
//			rest of digits are decimal minutes
// output : latitude in decimal degrees
nmea.parseLatitude = function(lat, hemi) {
	var h = (hemi === 'N') ? 1.0 : -1.0;
	var a;
	var dg;
	var mn;
	var l;
	a = lat.split('.');
	if(a[0].length === 4) {
		// two digits of degrees
		dg = lat.substring(0, 2);
		mn = lat.substring(2);
	} else if(a[0].length === 3) {
		// 1 digit of degrees (in case no leading zero)
		dg = lat.substring(0, 1);
		mn = lat.substring(1);
	} else {
		// no degrees, just minutes (nonstandard but a buggy unit might do this)
		dg = '0';
		mn = lat;
	}
	// latitude is usually precise to 5-8 digits
	return ((parseFloat(dg) + (parseFloat(mn) / 60.0)) * h).toFixed(8);
};

// decode longitude
// first three digits are degress
// rest of digits are decimal minutes
nmea.parseLongitude = function(lon, hemi) {
	var h;
	var a;
	var dg;
	var mn;
	h = (hemi === 'E') ? 1.0 : -1.0;
	a = lon.split('.');
	if(a[0].length === 5) {
		// three digits of degrees
		dg = lon.substring(0, 3);
		mn = lon.substring(3);
	} else if(a[0].length === 4) {
		// 2 digits of degrees (in case no leading zero)
		dg = lon.substring(0, 2);
		mn = lon.substring(2);
	} else if(a[0].length === 3) {
		// 1 digit of degrees (in case no leading zero)
		dg = lon.substring(0, 1);
		mn = lon.substring(1);
	} else {
		// no degrees, just minutes (nonstandard but a buggy unit might do this)
		dg = '0';
		mn = lon;
	}
	// longitude is usually precise to 5-8 digits
	return ((parseFloat(dg) + (parseFloat(mn) / 60.0)) * h).toFixed(8);
};

// fields can be empty so have to wrap the global parseInt
nmea.parseIntX = function(i) {
	if(i === '') {
		return 0;
	}
	return parseInt(i, 10);
};

/**
 * @brief converts a time string in the format HHMMSS.SSS (with millisecond
 *        precision) to a value in seconds as a float
 */
nmea.timeToMilliseconds = function(time)
{
	/* time format: HHMMSS.SSS (UTC) */
	var h = parseInt(time.substring(0,2));
	var m = parseInt(time.substring(2,4));
	var s = parseInt(time.substring(4,6));
	var ms = time.length > 7 ? parseInt(time.substring(7)) : 0;

	return 3600000*h + 60000*m + 1000*s + ms;
};

/**
 * @brief given a year in format YY (i.e., no century information), returns the
 *        year value in YYYY format
 */
nmea.yearToFullYear = function(year)
{
	/*
	 * use the current year to generate century information for the year on
	 * the given date (this assumes that the date is not older than 100 years
	 * from now...)
	 */
	var fullYearNow = (new Date()).getFullYear();
	var twoDigitYearNow = fullYearNow % 100;
	var centuryNow = fullYearNow - twoDigitYearNow;

	year += (year <= twoDigitYearNow) ? centuryNow : (centuryNow - 100);

	return year;

};

nmea.timeDateToMilliseconds = function(date, time)
{
	/* date format: DDMMYYYY.SSS (UTC) */
	var D = parseInt(date.substring(0,2));
	var M = parseInt(date.substring(2,4)) - 1;
	var Y = parseInt(date.substring(4,6));

	Y = nmea.yearToFullYear(Y);

	/* time format: HHMMSS.SSS (UTC) */
	var h = parseInt(time.substring(0,2));
	var m = parseInt(time.substring(2,4));
	var s = parseInt(time.substring(4,6));
	var ms = time.length > 7 ? parseInt(time.substring(7)) : 0;

	return Date.UTC(Y, M, D, h, m, s, ms);
};

nmea.parseDateTime = function(date, time)
{
	/* date format: DDMMYY (UTC) */
	var D = parseInt(date.substring(0,2));
	var M = parseInt(date.substring(2,4)) - 1;
	var Y = parseInt(date.substring(4,6));

	Y = nmea.yearToFullYear(Y);

	/* time format: HHMMSS.SSS (UTC) */
	var h = parseInt(time.substring(0,2));
	var m = parseInt(time.substring(2,4));
	var s = parseInt(time.substring(4,6));
	var ms = time.length > 7 ? parseInt(time.substring(7)) : 0;

	return new Date(Date.UTC(Y, M, D, h, m, s, ms));
};

// =====================================
// sentence parsers
// =====================================
/** GPGGA parser object */
nmea.GgaParser = function(id) {
	this.id = id;
	this.parse = function(tokens) {
		var i;
		var gga;
		if(tokens.length < 14) {
			nmea.error('GGA : not enough tokens');
			return null;
		}

		// trim whitespace
		// some parsers may not want the tokens trimmed so the individual parser has to do it if applicable
		for( i = 0; i < tokens.length; ++i) {
			tokens[i] = tokens[i].trim();
		}

		gga = {
			id : tokens[0].substr(1),
			time : tokens[1],
			latitude : nmea.parseLatitude(tokens[2], tokens[3]),
			longitude : nmea.parseLongitude(tokens[4], tokens[5]),
			fix : nmea.parseIntX(tokens[6], 10),
			satellites : nmea.parseIntX(tokens[7], 10),
			hdop : nmea.parseFloatX(tokens[8]),
			altitude : nmea.parseAltitude(tokens[9], tokens[10]),
			aboveGeoid : nmea.parseAltitude(tokens[11], tokens[12]),
			dgpsUpdate : tokens[13],
			dgpsReference : tokens[14]
		};

		return gga;
	};
};

/** GPRMC parser object */
nmea.RmcParser = function(id) {
	this.id = id;
	this.parse = function(tokens) {
		var rmc;
		if(tokens.length < 12) {
			nmea.error('RMC : not enough tokens');
			return null;
		}
		rmc = {
			id : tokens[0].substr(1),
			time : tokens[1],
			valid : tokens[2],
			latitude : nmea.parseLatitude(tokens[3], tokens[4]),
			longitude : nmea.parseLongitude(tokens[5], tokens[6]),
			speed : nmea.parseFloatX(tokens[7]),
			course : nmea.parseFloatX(tokens[8]),
			date : tokens[9],
			variation : nmea.parseDegrees(tokens[10], tokens[11]),
		};
		return rmc;
	};
};

/** GPGSV parser object */
nmea.GsvParser = function(id) {
	this.id = id;
	this.parse = function(tokens) {
		var gsv;
		var i;
		var sat;
		if(tokens.length < 14) {
			nmea.error('GSV : not enough tokens');
			return null;
		}

		// trim whitespace
		// some parsers may not want the tokens trimmed so the individual parser has to do it if applicable
		for(i=0;i<tokens.length;++i) {
			tokens[i] = tokens[i].trim();
		}

		gsv = {
			id : tokens[0].substr(1),
			msgs: nmea.parseIntX(tokens[1],10),
			mnum: nmea.parseIntX(tokens[2],10),
			count: nmea.parseIntX(tokens[3],10),
			sat:[]
			};

		// extract up to 4 sets of sat data
		for(i=4;i<tokens.length;i+= 4) {
			sat = {
				prn: nmea.parseIntX(tokens[i+0],10),
				el:nmea.parseIntX(tokens[i+1],10),
				az:nmea.parseIntX(tokens[i+2],10),
				ss:nmea.parseIntX(tokens[i+3],10)
			};

			gsv.sat.push(sat);
		}
		return gsv;
	};
};

// =====================================
// sentence encoders
// =====================================
/**
 GGA encoder object

 $GPGGA,hhmmss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx*hh

 GGA = Global Positioning System Fix Data
 1   = UTC of Position
 2   = Latitude
 3   = N or S
 4   = Longitude
 5   = E or W
 6   = GPS quality indicator (0=invalid; 1=GPS fix; 2=Diff. GPS fix)
 7   = Number of satellites in use [not those in view]
 8   = Horizontal dilution of position
 9   = Antenna altitude above/below mean sea level (geoid)
 10  = Meters	(Antenna height unit)
 11  = Geoidal separation (Diff. between WGS-84 earth ellipsoid and mean sea
       level; geoid is below WGS-84 ellipsoid)
 12  = Meters	(Units of geoidal separation)
 13  = Age in seconds since last update from diff. reference station
 14  = Diff. reference station ID#
 15  = Checksum

 input data:
 {
	 date          : DateTime object, UTC (year,month,day ignored)
	 latitude      : decimal degrees (north is +)
	 longitude     : decimal degreees (east is +)
	 fix           : integer 0,1,2
	 satellites    : integer 0..32
	 hdop          : float
	 altitude      : decimal altitude in meters
	 aboveGeoid    : decimal altitude in meters
	 dgpsUpdate    : time in seconds since last dgps update
	 dgpsReference : differential reference station id
 }

 any undefined values will be left blank ',,' (which is allowed in the nmea
 specification)
 */
nmea.GgaEncoder = function(id) {
	this.id = id;
	this.encode = function(id, data) {
		var a = [];
		var gga;

		a.push('$' + id);
		a.push(nmea.encodeTime(data.date));
		a.push(nmea.encodeLatitude(data.lat));
		a.push(nmea.encodeLongitude(data.lon));
		a.push(nmea.encodeValue(data.fix));
		a.push(nmea.encodeValue(nmea.padLeft(data.satellites.toString(), 2, '0')));
		a.push(nmea.encodeFixed(data.hdop, 1));
		a.push(nmea.encodeAltitude(data.altitude));
		a.push(nmea.encodeAltitude(data.aboveGeoid));
		a.push(nmea.encodeFixed(data.dgpsUpdate, 0));
		a.push(nmea.encodeValue(data.dgpsReference));

		gga = a.join();

		return gga;
	};
};

/**
 RMC encoder object

 $GPRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,x.x,a*hh

 RMC = Recommended Minimum Specific GPS/TRANSIT Data
 1   = UTC of position fix
 2   = Data status (V=navigation receiver warning)
 3   = Latitude of fix
 4   = N or S
 5   = Longitude of fix
 6   = E or W
 7   = Speed over ground in knots
 8   = Track made good in degrees True
 9   = UT date
 10  = Magnetic variation degrees (Easterly var. subtracts from true course)
 11  = E or W
 12  = Checksum

 input:
 {
	date      : Date UTC
	status    : String (single character)
	latitude  : decimal degrees (N is +)
	longitude : decimal degrees (E is +)
	speed     : decimal knots
	course    : decimal degrees
	variation : decimal magnetic variation (E is -)
 }
 */
nmea.RmcEncoder = function(id) {
	this.id = id;
	this.encode = function(id, data) {
		var a = [];
		var rmc;
		// $GPRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,x.x,a*hh

		a.push('$' + id);
		a.push(nmea.encodeTime(data.date));
		a.push(nmea.encodeValue(data.status));
		a.push(nmea.encodeLatitude(data.lat));
		a.push(nmea.encodeLongitude(data.lon));
		a.push(nmea.encodeKnots(data.speed));
		a.push(nmea.encodeDegrees(data.course));
		a.push(nmea.encodeDate(data.date));
		a.push(nmea.encodeMagVar(data.variation));

		rmc = a.join();

		return rmc;
	};
};

/**
 GSA encoder object

 $GPGSA,a,x,xx,xx,...,xx,x.x,x.x,x.x*hh

 GSA = Overall Satellite data (satellite status)
 1   = auto selection of 2D or 3D fix (A = automatic, M = manual)
 2   = 3D fix (1 = no fix, 2 = 2D fix, 3 = 3D fix)
 3.. = satellite numbers used for the fix (at most 12)
 ..n = PDOP (dilution of precision)
 n+1 = horizontal dilution of precision (HDOP)
 n+2 = vertical dilution of precision (VDOP)
 n+3 = checksum

 input data:
 {
	status     : String (single character)
	fix        : integer 0,1,2
	satellites : integer 0-12
	hdop       : float
	hdop       : float
	vdop       : float
 }
 */
nmea.GsaEncoder = function(id) {
	this.id = id;
	this.encode = function(id, data) {
		var a = [];
		var gsa;

		a.push('$' + id);
		a.push(nmea.encodeValue(data.status));
		a.push(nmea.encodeValue(data.fix));

		/* GSA requires 12 satellite tokens */
		for (var i = 1; i <= 12; ++i)
		{
			if (i <= parseInt(data.satellites))
			{
				a.push(nmea.padLeft(i.toString(), 2, '0'));
			}
			else
			{
				a.push('');
			}
		}

		a.push(nmea.encodeFixed(data.pdop, 1));
		a.push(nmea.encodeFixed(data.hdop, 1));
		a.push(nmea.encodeFixed(data.vdop, 1));

		gsa = a.join();

		return gsa;
	};
};

/** master parser function
 * handle string tokenizing, find the associated parser and call it if there is one
 */
nmea.parse = function(sentence) {
	var i;
	var tokens;
	var id;
	var result;
	var checksum;
	var status;
	if(( typeof sentence) !== 'string') {
		this.error('sentence is not a string');
		return null;
	}

	// find the checksum and remove it prior to tokenizing
	checksum = sentence.split('*');
	if(checksum.length === 2) {
		// there is a checksum
		sentence = checksum[0];
		checksum = checksum[1];
	} else {
		checksum = null;
	}

	tokens = sentence.split(',');
	if(tokens.length < 1) {
		this.error('must at least have a header');
		return null;
	}

	// design decision: the 5 character header field determines the sentence type
	// this field could be handled in two different ways
	// 1. split it into the 2 character 'talker id' + 3 character 'sentence id' e.g. $GPGGA : talker=GP id=GGA
	//		this would leave more room for customization of proprietary talkers that give standard sentences,
	//		but it would be more complex to deal with
	// 2. handle it as a single 5 character id string
	//		much simpler.	for a proprietary talker + standard string, just instantiate the parser twice
	// This version implements approach #2
	id = tokens[0].substring(1);
	if(id.length !== 5) {
		this.error('i must be exactly 5 characters');
		return null;
	}

	// checksum format = *HH where HH are hex digits that convert to a 1 byte value
	if(checksum !== null) {
		// there is a checksum, replace the last token and verify the checksum
		status = nmea.verifyChecksum(sentence, checksum);
		if(status === false) {
			this.error('checksum mismatch');
			return null;
		}
	}

	// try all id's until one matches
	result = null;
	for( i = 0; i < m_parserList.length; ++i) {
		if(id === m_parserList[i].id) {
			result = m_parserList[i].parse(tokens);
			break;
		}
	}
	if(result == null) {
		this.error('sentence id not found');
	}

	return result;
};

/** master encoder
 * find the specified id encoder and give it the data to encode. return the result;
 */
nmea.encode = function(id, data) {
	var i;
	var result;
	var cks;
	result = null;
	for( i = 0; i < m_encoderList.length; ++i) {
		if(id === m_encoderList[i].id) {
			result = m_encoderList[i].encode(id, data);
		}
	}
	if(result == null) {
		this.error('sentence id not found');
		return null;
	}

	// add the checksum
	cks = nmea.computeChecksum(result);
	result = result + cks;

	return result;
};

/** public function to print/handle errors */
nmea.error = function(msg) {
	if(m_errorHandler !== null) {
		// call the existing handler
		m_errorHandler(msg);
	}
};

/** public function to	set error handler */
nmea.setErrorHandler = function(e) {
	m_errorHandler = e;
};

// =======================================================
// initialize the handlers
// =======================================================

// add the standard error handler
nmea.setErrorHandler(function(e) {
	throw new Error('ERROR:' + e);
});

// add the standard parsers
nmea.addParser(new nmea.GgaParser("GPGGA"));
nmea.addParser(new nmea.RmcParser("GPRMC"));
nmea.addParser(new nmea.GsvParser("GPGSV"));

// add the standard encoders
nmea.addEncoder(new nmea.GgaEncoder("GPGGA"));
nmea.addEncoder(new nmea.RmcEncoder("GPRMC"));
nmea.addEncoder(new nmea.GsaEncoder("GPGSA"));
