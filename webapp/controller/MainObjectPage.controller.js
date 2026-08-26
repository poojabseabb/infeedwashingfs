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
                sourceHUVisible: false,
                tableVisible: true, // change to false when data is there
                ConfirmEnabled: true,
                ConfirmVisible: true,
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
            this.byId("txtWCScannerResult").setText(sWorkCenter);
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
            oViewModel.setProperty("/workCenter", sWorkCenter);
            this.byId("txtWCScannerResult").setText(sWorkCenter);
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
            oModel.read("/WorkCenterSet(Workcenter='" + sWorkCenter + "')", {
                // filters: aFilters,
                success: function (oData) {
                    var oViewModel = this.getView().getModel("viewModel");
                    /*
                    * No Work Center returned
                    */
                    if (!oData) {
                        MessageToast.show("Work Center is not valid.");
                        oViewModel.setProperty("/sourceHUVisible", false);
                        return;
                    }

                    var oResult = oData;
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
        /* REPACK SOURCE HU -> WASHING TRAY                     */
        /* ===================================================== */
        _repackSourceHU: function (oRow) {
            var oModel = this.getView().getModel();
            return new Promise(function (resolve, reject) {
                var oPayload = {
                    /*
                    * Replace these with the exact fields from your
                    * API metadata.-- API Data still pending confirmation
                    */
                    SourceHandlingUnit: oRow.SourceHU,
                    DestinationHandlingUnit: this.getView().getModel("viewModel").getProperty("/Palletnumber"),
                    Material: oRow.Material,
                    Quantity: Number(oRow.QuantityLoaded)
                    // QuantityUnit: oRow.QuantityUnit
                    // ProductUUID: oRow.ProductUUID
                    // etc.
                };
                oModel.callFunction("/RepackProductsIntoHandlingUnits", {
                    method: "POST",
                    urlParameters: oPayload,
                    success: function (oData) {
                        console.log("RepackProductsIntoHandlingUnits success:", oData);
                        resolve(oData);
                    }.bind(this),
                    error: function (oError) {
                        console.error("RepackProductsIntoHandlingUnits error:", oError);
                        reject(oError);
                    }.bind(this)
                });
            }.bind(this));
        },
        /* ===================================================== */
        /* CREATE WT FOR REMAINING SOURCE HU -> WISW            */
        /* ===================================================== */
        _createWTToWISW: function (oRow, iRemaining) {
            var oModel = this.getView().getModel();
            return new Promise(function (resolve, reject) {
                var oPayload = {
                    /*
                    * -- API Data still pending confirmation
                    */
                    WarehouseNumber: this.getView().getModel("viewModel").getProperty("/warehouseNumber"),
                    WarehouseTaskType: "",
                    SourceHandlingUnit: oRow.SourceHU,
                    Product: oRow.Material,
                    Quantity: Number(iRemaining),
                    DestinationStorageType: "WISW"
                    // DestinationStorageBin: ...
                    // SourceStorageType: ...
                    // SourceStorageBin: ...
                };

                oModel.create("/WarehouseTask", oPayload, {
                    success: function (oData) {
                        console.log("Warehouse Task to WISW created:", oData);
                        resolve(oData);
                    }.bind(this),
                    error: function (oError) {
                        console.error("Warehouse Task creation error:", oError);
                        reject(oError);
                    }.bind(this)
                });
            }.bind(this));
        },
        /* ===================================================== */
        /* CHECK WHETHER THIS IS THE LAST SCANNED HU            */
        /* ===================================================== */
        _isLastHU: function (oRow) {
            var oViewModel = this.getView().getModel("viewModel");
            var aProducts = oViewModel.getProperty("/ProductCollection") || [];
            var aRemainingRows = aProducts.filter(function (oProduct) {
                /*
                * Ignore the current row.
                */
                if (oProduct.SourceHU === oRow.SourceHU) {
                    return false;
                }
                return oProduct.ConfirmVisible !== false;
            });
            return aRemainingRows.length === 0;
        },
        /* ===================================================== */
        /* CREATE WASHING TRAY -> WASHING OUTFEED WT            */
        /* ===================================================== */
        _createWashingOutfeedWT: function () {
            var oModel = this.getView().getModel();
            var oViewModel = this.getView().getModel("viewModel");
            var sWarehouse = oViewModel.getProperty("/warehouseNumber");
            var sWashingTray = oViewModel.getProperty("/Palletnumber");
            return new Promise(function (resolve, reject) {
                var oPayload = {
                    WarehouseNumber: sWarehouse,
                    HandlingUnit: sWashingTray
                    /*
                    * Add the exact destination/process fields
                    * required by your EWM WarehouseTask API.-- API Data still pending confirmation
                    */
                };
                oModel.create("/WarehouseTask", oPayload, {
                    success: function (oData) {
                        console.log("Washing Outfeed Warehouse Task created:", oData);
                        resolve(oData);
                    }.bind(this),
                    error: function (oError) {
                        console.error("Washing Outfeed WT creation error:", oError);
                        reject(oError);
                    }.bind(this)
                });
            }.bind(this));
        },
        /* ===================================================== */
        /* CONFIRM FIRST WAREHOUSE TASK TOWARDS WASHING         */
        /* ===================================================== */
        _confirmWashingTask: function (oWT) {
            var oModel = this.getView().getModel();
            return new Promise(function (resolve, reject) {
                var oPayload = {
                    /*
                    * Replace these with the exact parameters
                    * from the API metadata.-- API Data still pending confirmation
                    */
                    WarehouseTask: oWT.WarehouseTask,
                    Quantity: oWT.Quantity
                    // WarehouseNumber: ...
                    // WarehouseTaskItem: ...
                    // Product: ...
                    // Unit: ...
                };
                oModel.callFunction("/ConfirmWarehouseTaskProduct", {
                    method: "POST",
                    urlParameters: oPayload,
                    success: function (oData) {
                        console.log("Washing Warehouse Task confirmed:", oData);
                        resolve(oData);
                    }.bind(this),
                    error: function (oError) {
                        console.error("Warehouse Task confirmation error:", oError);
                        reject(oError);
                    }.bind(this)
                });
            }.bind(this));
        },
        /* ===================================================== */
        /* ERROR MESSAGE HELPER                                 */
        /* ===================================================== */
        _getErrorMessage: function (oError) {

            if (!oError) {
                return "An unknown error occurred.";
            }
            try {
                if (oError.responseText) {
                    var oResponse = JSON.parse(oError.responseText);
                    if (oResponse.error && oResponse.error.message && oResponse.error.message.value) {
                        return oResponse.error.message.value;
                    }
                }
            } catch (e) {
                console.error("Could not parse SAP error:", e);
            }
            if (oError.message) {
                return oError.message;
            }
            return "An error occurred while processing the delivery.";
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
            oModel.read("/SourceHuSet(Sourcehu='" + sSourceHU + "', Workcenter='" + sWorkCenter + "')", {
                // oModel.read("/SourceHuSet(Sourcehu='900001005',Workcenter='WSHI')", {
                // filters: aFilters,
                success: function (oData) {
                    if (!oData) {
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
            if (aProducts.length > 0) {
                MessageToast.show("Product added.");
            } else {
                MessageToast.show("No Product found for the Source HU.");
            }
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
        handleDetailsPress: async function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("viewModel");
            if (!oContext) {
                MessageToast.show("Unable to determine selected HU.");
                return;
            }
            const oRow = oContext.getObject();
            oButton.setBusy(true);
            oRow.ConfirmEnabled = false;
            try {
                // 1. Repack source HU → washing tray
                await this._repackSourceHU(oRow);
                // 2. Calculate remaining quantity
                const iRemaining = Number(oRow.QuantityInPallet) - Number(oRow.QuantityLoaded);
                // 3. If something remains → WT to WISW
                if (iRemaining > 0) {
                    await this._createWTToWISW(oRow, iRemaining);
                }
                // 4. Disable/hide confirmation for this row
                oRow.ConfirmVisible = false;
                oRow.ConfirmEnabled = false;
                oContext.getModel().updateBindings(true);
                // 5. If this is the final HU
                if (this._isLastHU(oRow)) {
                    // Create washing tray → washing outfeed WT
                    const oWT = await this._createWashingOutfeedWT();
                    // Confirm first WT towards washing
                    await this._confirmWashingTask(oWT);
                }
                MessageToast.show("Delivery confirmed successfully.");
            } catch (oError) {
                console.error(oError);
                oRow.ConfirmEnabled = true;
                oContext.getModel().updateBindings(true);
                MessageToast.show(this._getErrorMessage(oError));
            } finally {
                oButton.setBusy(false);
            }
        }
    });
});