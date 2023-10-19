sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter"
], function (BaseController, JSONModel, formatter) {
    "use strict";

    return BaseController.extend("fr.applium.afl.aflapproval.controller.PDF", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        onInit: function () {
            // Control state model
            this._oPDFModel = new JSONModel({});
            this.setModel(this._oPDFModel, "pdfView");
            this._initPDFModel();
            this._oPDFViewer = this.byId("pdfViewer");

            this.getRouter().getRoute("pdf").attachPatternMatched(this._onPDFMatched, this);

            this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
         * Set the full screen mode to false and navigate to master page
         */
        onPressClosePDF: function (oEvent) {
            this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
            this.getRouter().navTo("object", {
                objectId: oEvent.getSource().getBindingContext().getProperty("DocumentId")
            });
        },

        /**
         * Toggle between full and non full screen mode.
         */
        onPressFullScreen: function () {
            var oAppViewModel = this.getModel("appView"),
                sLayout = oAppViewModel.getProperty("/layout");
            if (sLayout === "EndColumnFullScreen") {
                oAppViewModel.setProperty("/layout", "ThreeColumnsEndExpanded");
            } else {
                oAppViewModel.setProperty("/layout", "EndColumnFullScreen");
            }
        },


        /* =========================================================== */
        /* begin: internal methods                                     */
        /* =========================================================== */
        _initPDFModel: function () {
            this._oPDFModel.setProperty("/", {
                busy: false
            });
        },

        /**
         * Binds the view to the object path and expands the aggregated line items.
         * @function
         * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
         * @private
         */
        _onPDFMatched: function (oEvent) {
            var sObjectId = oEvent.getParameter("arguments").objectId;
            this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
            this.getModel().metadataLoaded().then(function () {
                var sObjectPath = this.getModel().createKey("Document", {
                    DocumentId: sObjectId
                });
                this._bindView("/" + sObjectPath);
            }.bind(this));
        },

        /**
         * Binds the view to the object path. Makes sure that detail view displays
         * a busy indicator while data for the corresponding element binding is loaded.
         * @function
         * @param {string} sObjectPath path to the object to be bound to the view.
         * @private
         */
        _bindView: function (sObjectPath) {
            // Set busy indicator during view binding

            // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
            this._oPDFModel.setProperty("/busy", false);

            this.getView().bindElement({
                path: sObjectPath,
                parameters: {
                    expand: "to_DocumentPDF",
                    select: "to_DocumentPDF/DocumentId,to_DocumentPDF/BusinessObjectType,to_DocumentPDF/ContentRepositoryId,to_DocumentPDF/ArchiveDocumentId"
                },
                events: {
                    change: this._onBindingChange.bind(this),
                    dataRequested: () => {
                        this._oPDFModel.setProperty("/busy", true);
                    },
                    dataReceived: () => {
                        this._oPDFModel.setProperty("/busy", false);
                    }
                }
            });
        },

        _onBindingChange: function () {
            var oView = this.getView(),
                oElementBinding = oView.getElementBinding(),
                sPath,
                oVIMDocument,
                oDataModel = this.getView().getModel(),
                sPDFPath = "";

            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("detailObjectNotFound");
                // if object could not be found, the selection in the master list
                // does not make sense anymore.
                this.getOwnerComponent().oListSelector.clearMasterListSelection();
                return;
            }

            sPath = oElementBinding.getPath();

            this.getOwnerComponent().oListSelector.selectAListItem(sPath);

            //Only get PDF keys (impossible to get media type as it's a media field)
            oVIMDocument = oView.getBindingContext().getObject({
                expand: "to_DocumentPDF",
                select: "to_DocumentPDF/DocumentId,to_DocumentPDF/BusinessObjectType,to_DocumentPDF/ContentRepositoryId,to_DocumentPDF/ArchiveDocumentId"
            });

            //Open PDF only if exists
            if (oVIMDocument.to_DocumentPDF) {
                sPDFPath = oDataModel.sServiceUrl + "/" + oDataModel.createKey("DocumentPDF", oVIMDocument.to_DocumentPDF) + "/$value";

                this._oPDFViewer.setSource(sPDFPath);
            } else {
                this._oPDFViewer.setSource("");
            }

        },

        _onMetadataLoaded: function () {
            // Binding the view will set it to not busy - so the view is always busy if it is not bound
            this._oPDFModel.setProperty("/busy", true);
        }


    });

});