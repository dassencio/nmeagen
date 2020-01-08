[![Build Status](https://api.travis-ci.com/dassencio/nmeagen.svg?branch=master)](https://travis-ci.com/dassencio/nmeagen)

# Description

NMEA Generator is a drawing tool for generating GPS logs in NMEA format. Being
a web application consisting of a single HTML file, it can be opened in a web
browser and used directly without the need for any installation or configuration
work.

This project contains the script (written in Python 3) used to build the
NMEA Generator. An example of a publicly available instance of this tool can be
found on [nmeagen.org](https://nmeagen.org).

# License

All files from this project are licensed under the GPLv3 except for those
belonging to the following projects:

- [jQuery](https://jquery.com/): licensed under the
  [MIT license](https://github.com/jquery/jquery/blob/master/LICENSE.txt).
- [Leaflet](https://leafletjs.com/): licensed under the
  [2-clause BSD license](https://github.com/Leaflet/Leaflet/blob/master/LICENSE).
- [Leaflet.PolylineDecorator](https://github.com/bbecquet/Leaflet.PolylineDecorator):
  licensed under the [MIT license](https://github.com/bbecquet/Leaflet.PolylineDecorator/blob/master/LICENSE).
- [Leaflet Search](https://github.com/stefanocudini/leaflet-search): licensed
  under the [MIT license](https://github.com/stefanocudini/leaflet-search/blob/master/license.txt).
- [nmea-0183](https://github.com/nherment/node-nmea): licensed under the
  [MIT license](https://github.com/nherment/node-nmea/blob/master/LICENSE).

See the [`LICENSE`](https://github.com/dassencio/mapgen/tree/master/LICENSE)
file for more information.

# Required modules

All Python modules needed to build the NMEA Generator are listed in the
[`requirements.txt`](https://github.com/dassencio/nmeagen/tree/master/requirements.txt)
file. You can install them with the following command:

    pip3 install -r requirements.txt

# Usage instructions

To build the NMEA Generator, simply run the following command:

    ./build

This will compile the NMEA Generator application as an HTML file named
`index.html` on the current working directory. If you wish to specify another
name or location for the output HTML file, use the `-o` option:

    ./build -o /path/to/nmeagen.html

# Running the functional tests

The NMEA Generator contains a set of functional tests which can be executed in
a web browser or in a terminal.

To execute the tests in a web browser, load the NMEA Generator and then
invoke the `runTests()` function in the browser's console.

To execute the tests in a terminal, run:

    ./run-tests -i /path/to/nmeagen.html

# Contributors & contact information

Diego Assencio / diego@assencio.com
