/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"fr/applium/afl/aflapproval/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});