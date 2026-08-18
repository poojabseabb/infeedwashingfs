sap.ui.define([
    "sap/ui/thirdparty/jquery",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat",
    "sap/base/Log",
    "sap/ui/core/Fragment",
    "sap/ui/core/date/UI5Date"
], (jQuery, Controller, JSONModel, MessageToast, DateFormat, Log, Fragment, UI5Date) => {
    "use strict";

    var prefixId;
    var oScanResultText;
    let oComponent, oModel;

    return Controller.extend("com.ewm.infeedwashingfs.controller.MainObjectPage", {
        onInit() {
            // var oJSONModel = this.initSampleDataModel();
            // this.getView().setModel(oJSONModel);

            var tempJson = new JSONModel();
            var oData = {
                "ProductCollection": [
                    {
                        "ProductId": "HT-1000",
                        "Category": "Laptops",
                        "MainCategory": "Computer Systems",
                        "TaxTarifCode": "1",
                        "SupplierName": "Very Best Screens",
                        "WeightMeasure": 4.2,
                        "WeightUnit": "KG",
                        "Description": "Notebook Basic 15 with 2,80 GHz quad core, 15\" LCD, 4 GB DDR3 RAM, 500 GB Hard Disc, Windows 8 Pro",
                        "Name": "Notebook Basic 15",
                        "DateOfSale": "2017-03-26",
                        "ProductPicUrl": "https://sdk.openui5.org/test-resources/sap/ui/documentation/sdk/images/HT-1000.jpg",
                        "Status": "Available",
                        "Quantity": 10,
                        "UoM": "PC",
                        "CurrencyCode": "EUR",
                        "Price": 956,
                        "Width": 30,
                        "Depth": 18,
                        "Height": 3,
                        "DimUnit": "cm"
                    }
                ]
            }
            tempJson.setData(oData);
            this.getView().setModel(tempJson);
        },
        onScanSuccess: function (oEvent) {
            var oView = this.getView(),
                oSourceControl = oEvent.getSource();
            oScanResultText = this.getView().byId("txtWCScannerResult");
            if (oEvent.getParameter("cancelled")) {
                MessageToast.show("Scan cancelled", { duration: 1000 });
            } else {
                if (oEvent.getParameter("text")) {
                    oScanResultText.setText(oEvent.getParameter("text"));
                    // this.getHeaderDetails(oComponent, oModel);
                } else {
                    oScanResultText.setText('');
                }
            }
        },
        onScanProdSuccess: function (oEvent) {
            var oView = this.getView(),
                oSourceControl = oEvent.getSource();
            oScanResultText = this.getView().byId("txtProdScannerResult");
            if (oEvent.getParameter("cancelled")) {
                MessageToast.show("Scan cancelled", { duration: 1000 });
            } else {
                if (oEvent.getParameter("text")) {
                    oScanResultText.setText(oEvent.getParameter("text"));
                    // this.getProductDetails(oComponent, oModel);
                } else {
                    oScanResultText.setText('');
                }
            }
        },
        onScanError: function (oEvent) {
            MessageToast.show("Scan failed: " + oEvent, { duration: 1000 });
        },
        onScanLiveupdate: function (oEvent) {

        }
    });
});