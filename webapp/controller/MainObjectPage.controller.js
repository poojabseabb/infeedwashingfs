sap.ui.define(["sap/ui/thirdparty/jquery", "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/MessageToast", "sap/ui/core/Fragment", "sap/ui/model/Filter", "sap/ui/model/FilterOperator"], (jQuery, Controller, JSONModel, MessageToast, Fragment, Filter, FilterOperator) => {
    "use strict";
    let oComponent, oModel;
    return Controller.extend("com.ewm.infeedwashingfs.controller.MainObjectPage", {
        onInit() {
            var oViewModel = new JSONModel({
                workCenter: "",
                Palletnumber: "",
                palletEnabled: false,
                palletEditable: false,
                sourceHUEnabled: false,
                tableVisible: true, // change to false when data is there
                ProductCollection: []
            });
            this.getView().setModel(oViewModel, "viewModel");
        },
        /* ===================================================== */
        /* WORK CENTER SCANNING                                  */
        /* ===================================================== */
        onWorkCenterScanSuccess: function (oEvent) {
            if (oEvent.getParameter("cancelled")) {
                MessageToast.show("Work Center scan cancelled.");
                return;
            }
            var sWorkCenter = oEvent.getParameter("text");
            if (!sWorkCenter) {
                MessageToast.show("Work Center scan returned no value.");
                return;
            }
            var oViewModel = this.getView().getModel("viewModel");
            sWorkCenter = sWorkCenter.trim();
            this._processWorkCenter(sWorkCenter);
            oViewModel.setProperty("/workCenter", sWorkCenter);
            // Now call your WorkCenterSet
            this._getWorkCenterDetails(sWorkCenter);
        },
        /* ===================================================== */
        /* MANUAL INPUT FROM WORK CENTER SCANNER                 */
        /* ===================================================== */
        onWorkCenterLiveUpdate: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            if (sValue !== undefined) {
                this._sManualWorkCenter = sValue.trim();
            }
        },
        /* ===================================================== */
        /* PROCESS WORK CENTER                                    */
        /* ===================================================== */
        _processWorkCenter: function (sWorkCenter) {
            if (!sWorkCenter) {
                MessageToast.show("Please enter a Work Center.");
                return;
            }
            var oViewModel = this.getView().getModel("viewModel");
            /*
             * Display scanned Work Center immediately.
             */
            oViewModel.setProperty("/workCenter", sWorkCenter);
            /*
             * Reset pallet/table state whenever a new
             * Work Center is scanned.
             */
            oViewModel.setProperty("/Palletnumber", "");
            oViewModel.setProperty("/palletEditable", false);
            oViewModel.setProperty("/palletEnabled", false);
            oViewModel.setProperty("/sourceHUVisible", false);
            oViewModel.setProperty("/tableVisible", false);
            /*
             * Clear existing HU rows when a new Work Center
             * session starts.
             */
            oViewModel.setProperty("/ProductCollection", []);
            /*
             * Call WorkCenterSet.
             */
            this._getWorkCenterDetails(sWorkCenter);
        },
        /* ===================================================== */
        /* WORK CENTER ODATA CALL                                */
        /* ===================================================== */
        _getWorkCenterDetails: function (sWorkCenter) {

            var oModel = this.getView().getModel();
            if (!oModel) {
                MessageToast.show("OData model is not available.");
                return;
            }
            var aFilters = [
                new Filter("Workcenter", FilterOperator.EQ, sWorkCenter)
            ];
            oModel.read("/WorkCenterSet", {
                filters: aFilters,
                success: function (oData) {
                    var oViewModel = this.getView().getModel("viewModel");
                    /*
                    * No Work Center returned
                    */
                    if (!oData || !oData.results || oData.results.length === 0) {
                        MessageToast.show("Work Center is not valid.");
                        oViewModel.setProperty("/sourceHUVisible", false);
                        return;
                    }

                    var oResult = oData.results[0];
                    var sPallet = oResult.Palletnumber || "";
                    var sWarehouse = oResult.WarehouseNumber || "";

                    oViewModel.setProperty("/warehouseNumber", sWarehouse);
                    /*
                    * Pallet found
                    */
                    if (sPallet) {
                        oViewModel.setProperty("/Palletnumber", sPallet);
                        oViewModel.setProperty("/palletEnabled", true);
                        oViewModel.setProperty("/palletEditable", false);
                        oViewModel.setProperty("/sourceHUVisible", true);
                        oViewModel.setProperty("/tableVisible", true);
                        MessageToast.show("Work Center validated.");
                    } else {
                        /*
                        * No pallet found.
                        *
                        * User must enter it manually.
                        */
                        oViewModel.setProperty("/Palletnumber", "");
                        oViewModel.setProperty("/palletEnabled", true);
                        oViewModel.setProperty("/palletEditable", true);
                        oViewModel.setProperty("/sourceHUVisible", false);
                        oViewModel.setProperty("/tableVisible", false);
                        MessageToast.show("No pallet found. Please enter the pallet number.");
                        setTimeout(function () {
                            var oInput = this.byId("palletInput");
                            if (oInput) {
                                oInput.focus();
                            }
                        }.bind(this), 100);
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("WorkCenterSet error:", oError);
                    MessageToast.show("Error while validating Work Center.");
                }.bind(this)
            });
        },
        /* ===================================================== */
        /* MANUAL PALLET ENTRY                                   */
        /* ===================================================== */
        onPalletSubmit: function (oEvent) {
            var sPallet = oEvent.getParameter("value");
            if (!sPallet) {
                MessageToast.show("Please enter the pallet number.");
                return;
            }
            sPallet = sPallet.trim();
            if (!sPallet) {
                MessageToast.show("Please enter the pallet number.");
                return;
            }
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/Palletnumber", sPallet);
            oViewModel.setProperty("/palletEditable", false);
            oViewModel.setProperty("/palletEnabled", true);
            oViewModel.setProperty("/sourceHUVisible", true);
            oViewModel.setProperty("/tableVisible", true);
            MessageToast.show("Pallet entered. Scan Source HU.");
        },
        /* ===================================================== */
        /* SOURCE HU SCANNING                                    */
        /* ===================================================== */
        onSourceHUScanSuccess: function (oEvent) {
            if (oEvent.getParameter("cancelled")) {
                MessageToast.show("Source HU scan cancelled.");
                return;
            }
            var sSourceHU = oEvent.getParameter("text");
            if (!sSourceHU) {
                MessageToast.show("No Source HU was scanned.");
                return;
            }
            sSourceHU = sSourceHU.trim();
            var oViewModel = this.getView().getModel("viewModel");
            var sWorkCenter = oViewModel.getProperty("/workCenter");
            var sPallet = oViewModel.getProperty("/Palletnumber");
            if (!sWorkCenter) {
                MessageToast.show("Please scan the Work Center first.");
                return;
            }
            if (!sPallet) {
                MessageToast.show("Please enter or scan the pallet number first.");
                return;
            }
            this._getSourceHUDetails(sSourceHU, sWorkCenter, sPallet);
        },
        /* ===================================================== */
        /* SOURCE HU ODATA CALL                                  */
        /* ===================================================== */
        _getSourceHUDetails: function (sSourceHU, sWorkCenter, sPallet) {
            var oModel = this.getView().getModel();
            if (!oModel) {
                MessageToast.show("OData model is not available.");
                return;
            }
            var aFilters = [
                new Filter("SourceHU", FilterOperator.EQ, sSourceHU),
                new Filter("Workcenter", FilterOperator.EQ, sWorkCenter),
                new Filter("Palletnumber", FilterOperator.EQ, sPallet)
            ];
            oModel.read("/SourceHuSet", {
                filters: aFilters,
                success: function (oData) {
                    if (!oData || !oData.results || oData.results.length === 0) {
                        MessageToast.show("Source HU not found.");
                        return;
                    }
                    this._appendSourceHUData(oData.results);
                }.bind(this),
                error: function (oError) {
                    console.error("SourceHuSet error:", oError);
                    MessageToast.show("Error while reading Source HU.");
                }.bind(this)
            });
        },
        /* ===================================================== */
        /* APPEND SOURCE HU TO TABLE                             */
        /* ===================================================== */
        _appendSourceHUData: function (aResults) {
            var oViewModel = this.getView().getModel("viewModel");
            var aProducts = oViewModel.getProperty("/ProductCollection") || [];
            aResults.forEach(function (oHU) {

                var oRow = {
                    SourceHU: oHU.Sourcehu,
                    Material: oHU.Material,
                    Itemdesc: oHU.Itemdesc,
                    Liftingtool: oHU.Liftingtool,
                    QuantityInPal: oHU.QuantityInPal,
                    QuantityReq: oHU.QuantityReq,
                    QuantityRem: oHU.QuantityRem,
                    QuantityLoaded: oHU.QuantityLoaded,
                    QuantityLoadedEditable: true,
                    ConfirmEnabled: true,
                    ConfirmVisible: true,
                    WorkInstruction: oHU.WorkInstruction
                };
                aProducts.push(oRow);
            });
            oViewModel.setProperty("/ProductCollection", aProducts);
            oViewModel.setProperty("/tableVisible", true);
            MessageToast.show("Source HU added.");
        },

        /* ===================================================== */
        /* SCANNER ERROR                                         */
        /* ===================================================== */
        onScanError: function (oEvent) {
            console.error("Barcode scanner error:", oEvent);
            MessageToast.show("Barcode scan failed.");
        },
        /* ===================================================== */
        /* GENERIC LIVE UPDATE                                   */
        /* ===================================================== */
        onScanLiveupdate: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            console.log("Scanner input:", sValue);
        },
        /* ===================================================== */
        /* CONFIRM DELIVERY                                      */
        /* ===================================================== */
        handleDetailsPress: function (oEvent) {

            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("viewModel");
            if (!oContext) {
                return;
            }
            var oRow = oContext.getObject();
            console.log("Selected row:", oRow);

        }
    });
});