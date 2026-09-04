sap.ui.define(["sap/ui/thirdparty/jquery", "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/MessageToast", "sap/ui/core/Fragment", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/ui/model/odata/v4/ODataModel"], (jQuery, Controller, JSONModel, MessageToast, Fragment, Filter, FilterOperator, ODataModel) => {
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

            // =====================================================
            // STANDARD SAP ODATA V4 MODELS FOR ACTIONS
            // =====================================================
            // Handling Unit API
            var oHandlingUnitModel = new ODataModel({
                serviceUrl: "/sap/opu/odata4/sap/api_handlingunit/srvd_a2x/sap/handlingunit/0001/",
                synchronizationMode: "None",
                operationMode: "Server",
                groupId: "$direct"
            });
            this.getView().setModel(oHandlingUnitModel, "handlingUnitV4");
            // Warehouse Order Task API
            var oWarehouseTaskModel = new ODataModel({
                serviceUrl: "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/",
                synchronizationMode: "None",
                operationMode: "Server",
                groupId: "$direct"
            });
            this.getView().setModel(oWarehouseTaskModel, "warehouseTaskV4");
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
            return new Promise(function (resolve, reject) {
                var oViewModel = this.getView().getModel("viewModel");
                /* -------------------------------------------------
                * 1. Get values from the selected table row
                * ------------------------------------------------- */
                var sSourceHU = oRow.Sourcehu;
                var sDestinationHU = oViewModel.getProperty("/Palletnumber");
                var sWorkCenter = oViewModel.getProperty("/workCenter");
                var sWarehouse = "VAST"; // Hardcoded for now, can be dynamic if needed
                if (!sSourceHU) {
                    reject(new Error("Source HU is missing."));
                    return;
                }
                if (!sDestinationHU) {
                    reject(new Error("Destination HU / Pallet number is missing."));
                    return;
                }
                if (!sWorkCenter) {
                    reject(new Error("Work Center is missing."));
                    return;
                }
                if (!sWarehouse) {
                    reject(new Error("Warehouse is missing."));
                    return;
                }
                console.log("========== REPACK START ==========");
                console.log("Source HU       :", sSourceHU);
                console.log("Destination HU  :", sDestinationHU);
                console.log("Work Center     :", sWorkCenter);
                console.log("Warehouse       :", sWarehouse);
                /* -------------------------------------------------
                * 3. GET from HandlingUnitItem
                * - StockItemUUID
                * - ETag
                * - X-CSRF-Token
                * ------------------------------------------------- */
                var sGetUrl = "/sap/opu/odata4/sap/api_handlingunit/srvd_a2x/" + "sap/handlingunit/0001/" + "HandlingUnit(" + "HandlingUnitExternalID='" + encodeURIComponent(sSourceHU) + "',Warehouse='" + encodeURIComponent(sWarehouse) + "'" + ")/_HandlingUnitItem";
                console.log("GET HandlingUnitItem URL:", sGetUrl);
                jQuery.ajax({
                    url: sGetUrl,
                    type: "GET",
                    dataType: "json",
                    headers: {
                        "X-CSRF-Token": "Fetch",
                        "Accept": "application/json"
                    },
                    success: function (oData, sStatus, oXHR) {
                        console.log("HandlingUnitItem GET successful.");
                        console.log("GET response:", oData);
                        var sCSRFToken = oXHR.getResponseHeader("X-CSRF-Token");
                        console.log("CSRF Token:", sCSRFToken);
                        if (!sCSRFToken) {
                            reject(new Error("CSRF token was not returned by the Handling Unit API."));
                            return;
                        }

                        var aItems = [];
                        if (oData && Array.isArray(oData.value)) {
                            aItems = oData.value;
                        } else if (oData && Array.isArray(oData.results)) {
                            // Fallback in case the response is OData V2-like
                            aItems = oData.results;
                        } else if (oData && oData.StockItemUUID) {
                            // Fallback if a single object is returned
                            aItems = [oData];
                        }
                        console.log("Handling Unit Item count:", aItems.length);
                        if (aItems.length === 0) {
                            reject(new Error("No Handling Unit Item found for Source HU " + sSourceHU));
                            return;
                        }
                        var oItem = aItems[0];
                        var sStockItemUUID = oItem.StockItemUUID;
                        if (!sStockItemUUID) {
                            reject(new Error("StockItemUUID was not returned for Source HU " + sSourceHU));
                            return;
                        }
                        console.log("StockItemUUID:", sStockItemUUID);
                        /* -------------------------------------------------
                        * 9. If ETag was not available as HTTP header,
                        *    try @odata.etag from response body.
                        * ------------------------------------------------- */
                        var sETag = oXHR.getResponseHeader("ETag");
                        console.log("ETag:", sETag);
                        if (!sETag && oItem["@odata.etag"]) {
                            sETag = oItem["@odata.etag"];
                            console.log("ETag obtained from @odata.etag:", sETag);
                        }
                        if (!sETag) {
                            reject(new Error("ETag was not returned by the Handling Unit API."));
                            return;
                        }
                        /* -------------------------------------------------
                        * 10. Build RepackHandlingUnitItem POST URL
                        * ------------------------------------------------- */
                        var sPostUrl = "/sap/opu/odata4/sap/api_handlingunit/srvd_a2x/" + "sap/handlingunit/0001/" + "HandlingUnitItem(" + "HandlingUnitExternalID='" + encodeURIComponent(sSourceHU) + "',Warehouse='" + encodeURIComponent(sWarehouse) + "',StockItemUUID=" + sStockItemUUID + ")" + "/SAP__self.RepackHandlingUnitItem";
                        console.log("POST RepackHandlingUnitItem URL:", sPostUrl);
                        /* -------------------------------------------------
                        * 11. POST payload
                        * ParentHandlingUnitNumber = washing tray/pallet
                        * EWMWorkCenter             = work center
                        * ------------------------------------------------- */
                        var oPayload = {
                            ParentHandlingUnitNumber: sDestinationHU,
                            EWMWorkCenter: sWorkCenter
                        };
                        console.log("Repack POST payload:", oPayload);
                        jQuery.ajax({
                            url: sPostUrl,
                            type: "POST",
                            contentType: "application/json",
                            dataType: "json",
                            data: JSON.stringify(oPayload),
                            headers: {
                                "X-CSRF-Token": sCSRFToken,
                                "If-Match": sETag,
                                "Accept": "application/json"
                            },
                            /* -------------------------------------------------
                            * 13. Repack successful
                            * ------------------------------------------------- */
                            success: function (oRepackData) {
                                console.log("RepackHandlingUnitItem successful.");
                                console.log("Repack response:", oRepackData);
                                console.log("========== REPACK SUCCESS ==========");
                                MessageToast.show("Source HU " + sSourceHU + " repacked successfully.");
                                resolve(oRepackData);
                            },
                            /* -------------------------------------------------
                            * 14. Repack failed
                            * ------------------------------------------------- */
                            error: function (oError) {
                                console.error("RepackHandlingUnitItem failed:", oError);
                                console.error("Repack response text:", oError.responseText);
                                var sErrorMessage = "Repack of Source HU " + sSourceHU + " failed.";
                                /* ---------------------------------------------
                                * Try to extract SAP error message
                                * --------------------------------------------- */
                                try {
                                    if (oError.responseJSON && oError.responseJSON.error) {
                                        var oSAPError = oError.responseJSON.error;
                                        if (oSAPError.message) {
                                            if (typeof oSAPError.message === "string") {
                                                sErrorMessage = oSAPError.message;
                                            } else if (oSAPError.message.value) {
                                                sErrorMessage = oSAPError.message.value;
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error("Unable to parse SAP error:", e);
                                }
                                console.error("Repack error message:", sErrorMessage);
                                /* ---------------------------------------------
                                * Reject so handleDetailsPress() catches it
                                * --------------------------------------------- */
                                var oErrorObject = new Error(sErrorMessage);
                                oErrorObject.response = oError;
                                reject(oErrorObject);
                            }
                        });
                    }.bind(this),
                    /* -------------------------------------------------
                    * 15. GET HandlingUnitItem failed
                    * ------------------------------------------------- */
                    error: function (oError) {
                        console.error("HandlingUnitItem GET failed:", oError);
                        console.error("GET response:", oError.responseText);
                        var sErrorMessage = "Unable to read Handling Unit Item for Source HU " + sSourceHU;
                        try {
                            if (oError.responseJSON && oError.responseJSON.error) {
                                var oSAPError = oError.responseJSON.error;
                                if (oSAPError.message) {
                                    if (typeof oSAPError.message === "string") {
                                        sErrorMessage = oSAPError.message;
                                    } else if (oSAPError.message.value) {
                                        sErrorMessage = oSAPError.message.value;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Unable to parse GET error:", e);
                        }
                        reject(new Error(sErrorMessage));
                    }
                });
            }.bind(this));
        },
        /* ===================================================== */
        /* CONFIRM FIRST WAREHOUSE TASK TOWARDS WASHING         */
        /* ===================================================== */
        _confirmWashingTask: async function (oWT) {
            var oWarehouseTaskModel = this.getView().getModel("warehouseTaskV4");
            if (!oWarehouseTaskModel) {
                throw new Error("Warehouse Task OData V4 model is not available.");
            }
            if (!oWT) {
                throw new Error("Warehouse Task information is missing.");
            }

            var sWarehouse = oWT.EWMWarehouse;
            var sWarehouseTask = oWT.WarehouseTask;
            var sWarehouseTaskItem = oWT.WarehouseTaskItem;
            if (!sWarehouse || !sWarehouseTask || !sWarehouseTaskItem) {
                throw new Error("Incomplete Warehouse Task key information.");
            }
            var sTaskPath = "/WarehouseTask(" + "EWMWarehouse='" + encodeURIComponent(sWarehouse) + "'," + "WarehouseTask='" + encodeURIComponent(sWarehouseTask) + "'," + "WarehouseTaskItem='" + encodeURIComponent(sWarehouseTaskItem) + "'" + ")";
            // -------------------------------------------------
            // Bind ConfirmWarehouseTaskExact action
            // -------------------------------------------------
            var oActionBinding = oWarehouseTaskModel.bindContext(sTaskPath + "/SAP__self.ConfirmWarehouseTaskExact(...)");
            try {
                await oActionBinding.execute();
                MessageToast.show("Warehouse Task " + sWarehouseTask + " confirmed.");
                return true;
            } catch (oError) {
                console.error("ConfirmWarehouseTaskExact failed:", oError);
                throw oError;
            }
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
            this.byId("txtSHUScannerResult").setText(sSourceHU);
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
            oModel.read("/SourceHuSet(Sourcehu='" + sSourceHU + "',Workcenter='" + sWorkCenter + "')", {
                // oModel.read("/SourceHuSet(Sourcehu='900001005',Workcenter='WSHI')", {
                // filters: aFilters,
                success: function (oData) {
                    if (!oData) {
                        MessageToast.show("Source HU not found.");
                        return;
                    }
                    this._appendSourceHUData(oData);
                }.bind(this),
                error: function (oError) {
                    console.error("SourceHuSet error:", oError);
                    MessageToast.show("Error while reading Source HU.");
                }.bind(this)
            });
        },
        /* ===================================================== */
        /* BUILD WORK INSTRUCTION URL FROM MATERIAL              */
        /* ===================================================== */
        _buildWorkInstructionUrl: function (sMaterial) {
            if (!sMaterial) {
                return "";
            }
            var sBaseUrl = "https://<server>:<port>/"; // Check with Functional on what will be this data
            return sBaseUrl + encodeURIComponent(sMaterial) + ".docx";
        },
        /* ===================================================== */
        /* APPEND SOURCE HU TO TABLE                             */
        /* ===================================================== */
        _appendSourceHUData: function (oData) {
            var oViewModel = this.getView().getModel("viewModel");
            var aProducts = oViewModel.getProperty("/ProductCollection") || [];
            var aResults = Array.isArray(oData) ? oData : [oData];
            console.log("Source HU result count:", aResults.length);
            console.log("Source HU results:", aResults);
            aResults.forEach(function (oHU) {
                console.log("Processing Source HU:", oHU);
                // -------------------------------------------------
                // DUPLICATE SOURCE HU VALIDATION
                // -------------------------------------------------
                var bAlreadyExists = aProducts.some(
                    function (oExistingRow) {
                        return String(oExistingRow.Sourcehu).trim() === String(oHU.Sourcehu).trim();
                    });
                if (bAlreadyExists) {
                    MessageToast.show("Source HU " + oHU.Sourcehu + " already exists.");
                    console.log("Duplicate Source HU - not adding:", oHU.Sourcehu);
                    this.byId("txtSHUScannerResult").setText("");
                    return;
                }

                // -------------------------------------------------
                // CREATE NEW TABLE ROW ONLY IF NO DUPLICATE EXIST
                // ------------------------------------------------
                var oRow = {
                    Sourcehu: oHU.Sourcehu,
                    Workcenter: oHU.Workcenter,
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
                    WorkInstruction: this._buildWorkInstructionUrl(oHU.Material),

                    // WorkInstruction: oHU.WorkInstruction,
                    // StockItemUUID: oHU.StockItemUUID,
                    // QuantityUnit: oHU.QuantityUnit,
                    // UnitOfMeasureSAPCode: oHU.UnitOfMeasureSAPCode,
                    // UnitOfMeasureISOCode: oHU.UnitOfMeasureISOCode,
                };

                console.log("Row added to ProductCollection:", oRow);
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
        /* WORK INSTRUCTION LINK PRESS                            */
        /* ===================================================== */
        onWorkInstructionPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("viewModel");
            if (!oContext) {
                MessageToast.show("Unable to find material information.");
                return;
            }
            var sUrl = oContext.getProperty("WorkInstruction");
            if (!sUrl) {
                MessageToast.show("Work instruction is not available.");
                return;
            }
            // Open in a new browser tab
            window.open(sUrl, "_blank");
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
                const iRemaining = Number(oRow.QuantityInPal) - Number(oRow.QuantityLoaded);
                // const iRemaining = Number(oRow.QuantityRem);
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
                console.error("Confirm delivery failed:", oError);
                oRow.ConfirmEnabled = true;
                oContext.getModel().updateBindings(true);
                MessageToast.show(this._getErrorMessage(oError));
            } finally {
                oButton.setBusy(false);
            }
        }
    });
});