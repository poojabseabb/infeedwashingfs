/*global QUnit*/

sap.ui.define([
	"com/ewm/infeedwashingfs/controller/MainObjectPage.controller"
], function (Controller) {
	"use strict";

	QUnit.module("MainObjectPage Controller");

	QUnit.test("I should test the MainObjectPage controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
