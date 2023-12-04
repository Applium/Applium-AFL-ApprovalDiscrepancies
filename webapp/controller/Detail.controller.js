sap.ui.define(
  [
    "sap/suite/ui/commons/library",
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/m/library",
    "sap/m/PDFViewer",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "sap/ui/core/format/DateFormat",
    "sap/ui/Device",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
  ],
  function (
    SuiteLibrary,
    BaseController,
    JSONModel,
    formatter,
    mobileLibrary,
    PDFViewer,
    MessageBox,
    Item,
    DateFormat,
    Device,
    MessageToast,
    Fragment
  ) {
    "use strict";
    //jQuery.sap.require("sap.suite.ui.commons.ProcessFlowZoomLevel");

    // shortcut for sap.m.URLHelper
    var URLHelper = mobileLibrary.URLHelper;

    return BaseController.extend("fr.applium.afl.aflapprovaldisc.controller.Detail", {
      formatter: formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      onInit: function () {
        // Model used to manipulate control states. The chosen values make sure,
        // detail page is busy indication immediately so there is no break in
        // between the busy indication for loading the view's meta data
        this._oDetailModel = new JSONModel({
          busy: false,
          delay: 0,
          lineItemListTitle: this.getResourceBundle().getText("Detail.LineItemTableHeading"),
          document: {
            opened: false,
          },
          comment: {
            value: "",
            beginEnabled: false,
            warningVisible: false,
            mandatory: true,
          },
          validateButtonPressed: false,
          rejectButtonPressed: false,
          addCommentButtonPressed: false,
        });

        //Pending uploads
        this._iPendingUploads = 0;

        this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
        this.getRouter().getRoute("pdf").attachPatternMatched(this._onObjectMatched, this);

        this.setModel(this._oDetailModel, "detailView");
        //this._oDetailModel = this.getModel("detailView");

        this._initDetailModel();

        // this._getGlobalDocumentTypes();

        //this._getAttachmentMode();

        this._DisableDragDropUploadSet();

        this._oI18n = this.getResourceBundle();

        this.oListSelector = this.getOwnerComponent().oListSelector;

        this.getODataModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
      },

      onBeforeRendering: function () {
        // if (
        //   this._oDetailModel.setProperty("/approvalStepsVisible") === true &&
        //   this.byId("processflow").getLanes().length === 0
        // ) {
        //   this._oDetailModel.setProperty("/approvalStepsVisible", false);
        // }
      },
      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      //### HEADER ACTION BUTTONS ###

      /**
       * Open the third column to display PDF document.
       */
      onPressShowPDF: function (oEvent) {
        this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
        this.getRouter().navTo("pdf", {
          objectId: oEvent.getSource().getBindingContext().getProperty("DocumentId"),
        });
      },

      onBeforeRebindTable: function (oEvent) {
        var oBindingParams = oEvent.getParameter("bindingParams");
        oBindingParams.parameters.numberOfExpandedLevels = 1;
        oBindingParams.parameters.select += ",DocumentId,DocumentItemId,ItemBlocked";
      },

      /**
       * Toggle between full and non full screen mode.
       */
      onPressFullScreen: function () {
        var oAppViewModel = this.getModel("appView"),
          sLayout = oAppViewModel.getProperty("/layout");
        if (sLayout === "TwoColumnsMidExpanded") {
          oAppViewModel.setProperty("/layout", "MidColumnFullScreen");
        } else {
          oAppViewModel.setProperty("/layout", "TwoColumnsMidExpanded");
        }
      },

      /**
       * Set the full screen mode to false and navigate to master page
       */
      onPressCloseDetail: function () {
        // No item should be selected on master after detail page is closed
        this.getOwnerComponent().oListSelector.clearMasterListSelection();
        this.getRouter().navTo("master");
      },

      /**
       * Create a comment
       * @param {object} oEvent an event containing the total number of items in the list
       * @private
       */
      onPostComment: function (oEvent) {
        var sComment = this._oDetailModel.getProperty("/newComment"),
          sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
          oCommentDate = new Date(),
          oModel = this.getODataModel();

        oModel.create("/DocumentComment", {
          DocumentId: sDocumentId,
          LogDate: oCommentDate,
          LogDatetime: oCommentDate,
          LogComment: sComment,
        });
        //refresh items of feedList
        this.byId("feedList").getBinding("items").refresh();
      },
      /*** Attachment Section ***/
      _getGlobalDocumentTypes: function () {
        this._oDetailModel.setProperty("/busy", false);

        this.getODataModel().read("/GlobalDocumentTypes", {
          success: function (oData, oResponse) {
            //Release busy state
            this._oDetailModel.setProperty("/busy", false);
            this._oDetailModel.setProperty("/aGlobalDocumentTypes", oResponse.data.results);
          }.bind(this),

          error: function (oError) {
            // show error
            this._oDetailModel.setProperty("/busy", false);
            this.handleErrorMessage(this.determineODataErrorText(oError));
          }.bind(this),
        });
      },
      _getAttachmentMode: function () {
        this._oDetailModel.setProperty("/busy", false);

        this.getODataModel().read("/AttachmentMode('" + "HISTORY" + "')", {
          success: function (oData, oResponse) {
            //Release busy state
            this._oDetailModel.setProperty("/busy", false);
            this._oDetailModel.setProperty("/oAttachmentMode", oData);
          }.bind(this),

          error: function (oError) {
            // show error
            this._oDetailModel.setProperty("/busy", false);
            this.handleErrorMessage(this.determineODataErrorText(oError));
          }.bind(this),
        });
      },
      _DisableDragDropUploadSet: function () {
        this.byId("attachmentUploadSet").addDelegate(
          {
            ondragenter: function (oEvent) {
              oEvent.stopPropagation();
            },
            ondragover: function (oEvent) {
              oEvent.stopPropagation();
            },
            ondrop: function (oEvent) {
              oEvent.stopPropagation();
            },
          },
          true
        );
      },
      onUploadSelectedButton: function (oEvent) {
        var aGlobalDocumentTypes = this._oDetailModel.getProperty("/aGlobalDocumentTypes"),
          oUploadButton = this.byId("uploadSelectedButton");

        if (!this.actionSheet) {
          this.actionSheet = new sap.m.ActionSheet({
            id: "actionSheet",
            placement: "Bottom",
          });
          aGlobalDocumentTypes.forEach(
            function (oDocumentType) {
              var oButton = new sap.m.Button({
                id: oDocumentType.ArObject,
                text: oDocumentType.Objecttext,
                press: function (oEvent) {
                  this.onUploadDocType(oEvent);
                }.bind(this),
              });
              this.actionSheet.addButton(oButton);
            }.bind(this)
          );
        }
        this.actionSheet.openBy(oUploadButton);
      },
      onUploadDocType: function (oEvent) {
        var sGlobalDocumentType = oEvent.getSource().getId(),
          oUploadSet = this.byId("attachmentUploadSet"),
          aGlobalDocumentTypes = this._oDetailModel.getProperty("/aGlobalDocumentTypes"),
          oGlobalDocumentTypes,
          aAuthorizedExtension = [],
          aAuthorizedExtensionPoint = [];

        oGlobalDocumentTypes = aGlobalDocumentTypes.find(function (item) {
          return item.ArObject === sGlobalDocumentType;
        });

        if (oGlobalDocumentTypes.DocType !== "") {
          aAuthorizedExtension.push(oGlobalDocumentTypes.DocType.toLowerCase());
        }

        //**********************************************************************************
        //* Ugly but to prevent sap bug when data binding on fileTypes property and toolbar*                                   *
        //**********************************************************************************

        //For data binding of property "fileTypes" of control UploadSet, but not work with toolbar
        //==> prevent sap with this bug
        this._oDetailModel.setProperty("/aAuthorizedExtension", aAuthorizedExtension);
        //oUploadSet.setFileTypes(aAuthorizedExtension);
        if (aAuthorizedExtension.length > 0) {
          oUploadSet._oFileUploader.setFileType(aAuthorizedExtension);

          aAuthorizedExtensionPoint = aAuthorizedExtension.map(function (sExtension) {
            return "." + sExtension;
          });

          oUploadSet._oFileUploader.oFileUpload.accept = aAuthorizedExtensionPoint;
        } else {
          oUploadSet._oFileUploader.setFileType([]);
          oUploadSet._oFileUploader.oFileUpload.accept = "";
        }
        //**********************************************************************************

        this._oDetailModel.setProperty("/sSelectedDocumentType", sGlobalDocumentType);

        //oUploadSet.openFileDialog(); not defined in this version of SAPUI5 1.71.49

        //Ugly but mandatory to open fileuploaderdialog
        oUploadSet.$().find("input[type=file]").trigger("click"); //to replace with oUploadSet.openFileDialog();
      },
      onfileTypeMismatch: function (oEvent) {
        var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
        MessageBox.error(this._oI18n.getText("Detail.Section.Attachment.MessageBox.Error.Text.extensionFile"), {
          styleClass: bCompact ? "sapUiSizeCompact" : "",
        });
      },
      compareVersions: function (version1, version2) {
        var version1Components = version1.split(".");
        var version2Components = version2.split(".");
        var length = Math.max(version1Components.length, version2Components.length);

        for (var i = 0; i < length; i++) {
          var v1 = version1Components[i] || 0;
          var v2 = version2Components[i] || 0;
          if (v1 !== v2) {
            return v1 > v2 ? 1 : -1;
          }
        }

        return 0;
      },
      /**
       * Before item is added
       * Set busy indicator to the uploadSet
       * @function
       * @param {object} oEvent An event containing file context
       * @public
       */
      onAttachmentBeforeItemAdded: function (oEvent) {
        this._iPendingUploads += 1;
        this._oDetailModel.setProperty("/busyAttachmentsList", true);
      },

      /**
       * Before upload starts
       * This function adds header parameter to http request
       * @function
       * @param {object} oEvent An event containing file context
       * @public
       */
      onAttachmentBeforeUploadStarts: function (oEvent) {
        var oUploadSet = oEvent.getSource(),
          oItem = oUploadSet.getBindingContext().getObject(),
          oSlugHeader = new Item({
            key: "slug",
            text: oEvent.getParameter("item").getFileName(),
          }),
          oDocumentId = new Item({
            key: "DocumentId",
            text: oItem.DocumentId,
          }),
          oObjectNumber = new Item({
            key: "ObjectNumber",
            text: oItem.ObjectNumber,
          }),
          oObjectCode = new Item({
            key: "ObjectCode",
            text: oItem.ObjectCode,
          }),
          oTokenHeader = new Item({
            key: "x-csrf-token",
            text: this.getODataModel().getSecurityToken(),
          });

        oUploadSet.removeAllHeaderFields();
        oUploadSet.addHeaderField(oSlugHeader);
        oUploadSet.addHeaderField(oDocumentId);
        oUploadSet.addHeaderField(oObjectNumber);
        oUploadSet.addHeaderField(oObjectCode);
        oUploadSet.addHeaderField(oTokenHeader);
      },

      onGlobDocTypeBeforeUploadStarts: function (oEvent) {
        var oUploadSet = oEvent.getSource(),
          oItem = oUploadSet.getBindingContext().getObject(),
          oSlugHeader = new Item({
            key: "slug",
            text: oEvent.getParameter("item").getFileName(),
          }),
          oDocumentId = new Item({
            key: "DocumentId",
            text: oItem.DocumentId,
          }),
          oArcDocId = new Item({
            key: "ArcDocId",
            text: oItem.ArcDocId,
          }),
          oArObject = new Item({
            key: "ArObject",
            text: this._oDetailModel.getProperty("/sSelectedDocumentType"),
          }),
          oTokenHeader = new Item({
            key: "x-csrf-token",
            text: this.getODataModel().getSecurityToken(),
          }),
          sSelectedDocType = this._oDetailModel.getProperty("/sSelectedDocumentType"),
          sFileName = oEvent.getParameter("item").getFileName(),
          aGlobalDocumentTypes = this._oDetailModel.getProperty("/aGlobalDocumentTypes"),
          sFileExtension = sFileName.split(".").slice(-1)[0],
          sAuthorizedExtension,
          oGlobalDocumentTypes;

        oGlobalDocumentTypes = aGlobalDocumentTypes.find(function (item) {
          return item.ArObject === sSelectedDocType;
        });

        sAuthorizedExtension = oGlobalDocumentTypes.DocType;

        if (sAuthorizedExtension !== "" && sAuthorizedExtension.toUpperCase() !== sFileExtension.toUpperCase()) {
          var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
          MessageBox.error(
            this._oI18n.getText("Detail.Section.Attachment.MessageBox.Error.Text.extension", [
              sAuthorizedExtension.toUpperCase(),
            ]),
            {
              styleClass: bCompact ? "sapUiSizeCompact" : "",
            }
          );
        } else {
          oUploadSet.removeAllHeaderFields();
          oUploadSet.addHeaderField(oSlugHeader);
          oUploadSet.addHeaderField(oDocumentId);
          oUploadSet.addHeaderField(oArcDocId);
          oUploadSet.addHeaderField(oArObject);
          oUploadSet.addHeaderField(oTokenHeader);
        }
      },

      /**
       * On upload complete, refresh binding.
       * Note : Maybe it's possible to not update all binding to avoid refresh list effect (n items > 0 item > n+1 items)
       * @param {object} oEvent an event containing items binding
       * @public
       */
      onUploadCompleteAttachment: function (oEvent) {
        var oItem = oEvent.getParameter("item");

        this.byId("attachmentUploadSet").removeItem(oItem);

        //Upload complete, refresh after the last item only
        this._iPendingUploads -= 1;

        if (this._iPendingUploads < 1) {
          this._refreshAttachmentBinding();
        }
      },

      onGlobDocTypeUploadComplete: function (oEvent) {
        var oItem = oEvent.getParameter("item");

        if (this.compareVersions(sap.ui.version, "1.98.0") >= 0) {
          var response = oEvent.getParameter("response"),
            status = oEvent.getParameter("status"),
            parser,
            xmlDoc,
            message;
          if (status >= 400) {
            parser = new DOMParser();
            xmlDoc = parser.parseFromString(response, "text/xml");
            message = xmlDoc.getElementsByTagName("message")[0].innerHTML;

            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
            MessageBox.error(message, {
              styleClass: bCompact ? "sapUiSizeCompact" : "",
            });
          }
        }

        this.byId("attachmentUploadSet").removeItem(oItem);

        //Upload complete, refresh after the last item only
        this._iPendingUploads -= 1;

        if (this._iPendingUploads < 1) {
          this._refreshGlobDocTypeBinding();
        }
      },
      /**
       * On press attachment delete, open Dialog to confirm deleting attanchment
       * @param {object} oEvent an event containing item to delete
       * @public
       */
      onPressDeletedAttachment: function (oEvent) {
        var oObjectToDelete = oEvent.getParameter("item").getBindingContext().getObject();

        //No default action
        oEvent.preventDefault();

        MessageBox.show(
          this._oI18n.getText("Detail.Section.Attachment.MessageBox.ConfirmDeletedAttachment.Text", [
            oObjectToDelete.ObjectDescription,
            oObjectToDelete.FileFormat,
          ]),
          {
            icon: MessageBox.Icon.NONE,
            title: this._oI18n.getText("Detail.Section.Attachment.MessageBox.ConfirmDeletedAttachment.Title"),
            actions: [
              MessageBox.Action.OK,
              this._oI18n.getText("Detail.Section.Attachment.MessageBox.ConfirmDeletedAttachment.Cancel"),
            ],
            onClose: function (sAction) {
              if (sAction === MessageBox.Action.OK) {
                this._onFileDeletedAttachment(oObjectToDelete);
              }
            }.bind(this),
          }
        );
      },

      /**
       * User press on an attachment in the attachment section
       * @param {object} oEvent an event containing the binding object to use
       * @public
       */
      onPressAttachmentItem: function (oEvent) {
        var oAttachment = oEvent.getSource().getBindingContext().getObject(),
          sServiceUrl = this._oDetailModel.getProperty("/serviceUrl"),
          oModel = this.getODataModel(),
          sSourcePath =
            sServiceUrl +
            "/" +
            oModel.createKey("DocumentAttachment", {
              DocumentId: oAttachment.DocumentId,
              ObjectNumber: oAttachment.ObjectNumber,
              ObjectCode: oAttachment.ObjectCode,
              ObjectYear: oAttachment.ObjectYear,
            }) +
            "/$value",
          sExt = oAttachment.FileFormat;

        //No default action
        oEvent.preventDefault();

        //PDF Viewer
        if (sExt && sExt.toLowerCase() === "pdf") {
          if (!this._oPDFViewer) {
            this._oPDFViewer = new PDFViewer();
          }
          this._oPDFViewer.setSource(sSourcePath);
          this._oPDFViewer.setTitle(oAttachment.ObjectDescription);
          this._oPDFViewer.open();
        }
        //Download other files
        else {
          sap.m.URLHelper.redirect(sSourcePath, true);
        }
      },
      onPressGlobDocTypAttachmentItem: function (oEvent) {
        var oAttachment = oEvent.getSource().getBindingContext().getObject(),
          sServiceUrl = this._oDetailModel.getProperty("/serviceUrl"),
          oModel = this.getODataModel(),
          sSourcePath =
            sServiceUrl +
            "/" +
            oModel.createKey("GlobalDocumentTypesAttachment", {
              DocumentId: oAttachment.DocumentId,
              ArcDocId: oAttachment.ArcDocId,
              ArObject: this._oDetailModel.getProperty("/sSelectedDocumentType"),
            }) +
            "/$value",
          sExt = oAttachment.FileFormat;

        //No default action
        oEvent.preventDefault();

        //PDF Viewer
        if (sExt && sExt.toLowerCase() === "pdf") {
          if (!this._oPDFViewer) {
            this._oPDFViewer = new PDFViewer();
          }
          this._oPDFViewer.setSource(sSourcePath);
          this._oPDFViewer.setTitle(oAttachment.ObjectDescription);
          this._oPDFViewer.open();
        }
        //Download other files
        else {
          sap.m.URLHelper.redirect(sSourcePath, true);
        }
      },
      /* =========================================================== */
      /* begin: internal methods                                     */
      /* =========================================================== */

      /**
       * Binds the view to the object path and expands the aggregated line items.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
       * @private
       */
      _onObjectMatched: function (oEvent) {
        var sObjectId = oEvent.getParameter("arguments").objectId;
        this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
        this.getODataModel()
          .metadataLoaded()
          .then(
            function () {
              var sObjectPath = this.getODataModel().createKey("Document", {
                DocumentId: sObjectId,
              });
              this._bindView("/" + sObjectPath);
            }.bind(this)
          );

        //Set zoom defaut level for proccess flow
        //this.byId("processflow").setZoomLevel("One");
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
        var oViewModel = this.getModel("detailView");

        // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
        oViewModel.setProperty("/busy", false);

        this.getView().bindElement({
          path: sObjectPath,
          parameters: {
            // expand: "to_DocumentPDF,to_ApprovalType,to_StatusVIM,to_DocumentComment,to_DocumentItem",
            expand: "to_DocumentPDF,to_ApprovalType,to_StatusVIM,to_DocumentItem",
          },
          events: {
            change: this._onBindingChange.bind(this),
            dataRequested: function () {
              oViewModel.setProperty("/busy", true);
            },
            dataReceived: function () {
              oViewModel.setProperty("/busy", false);
            },
          },
        });
      },

      _onBindingChange: function () {
        var oView = this.getView(),
          oVIMDocument = oView.getBindingContext().getObject({
            expand: "to_DocumentItem,to_AvoirId,to_DocumentPDF",
          }),
          oElementBinding = oView.getElementBinding();

        // No data for the binding
        if (!oElementBinding.getBoundContext()) {
          this.getRouter().getTargets().display("detailObjectNotFound");
          // if object could not be found, the selection in the list
          // does not make sense anymore.
          this.getOwnerComponent().oListSelector.clearMasterListSelection();
          return;
        }

        var sPath = oElementBinding.getPath(),
          oResourceBundle = this.getResourceBundle(),
          oObject = this.getODataModel().getObject(sPath),
          sObjectId = oObject.DocumentId,
          sObjectName = oObject.DocumentDate,
          oViewModel = this.getModel("detailView");

        this.getOwnerComponent().oListSelector.selectAListItem(sPath);

        // this._callGetApprovalSteps();
      },

      _onMetadataLoaded: function () {
        // Binding the view will set it to not busy - so the view is always busy if it is not bound
        this._oDetailModel.setProperty("/busy", true);
        // Store original busy indicator delay for the detail view
        var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
          oViewModel = this.getModel("detailView"),
          oLineItemTable = this.byId("lineItemsList"),
          iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

        // Make sure busy indicator is displayed immediately when
        // detail view is displayed for the first time
        oViewModel.setProperty("/delay", 0);
        oViewModel.setProperty("/lineItemTableDelay", 0);

        oLineItemTable.attachEventOnce("updateFinished", function () {
          // Restore original busy indicator delay for line item table
          oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
        });

        // Binding the view will set it to not busy - so the view is always busy if it is not bound
        oViewModel.setProperty("/busy", true);
        // Restore original busy indicator delay for the detail view
        oViewModel.setProperty("/delay", iOriginalViewBusyDelay);

        oViewModel.setProperty("/serviceUrl", this.getODataModel().sServiceUrl);
      },

      /**
       * On attachment delete, send DELETE request to backend
       * @param {object} oEvent an event containing item to delete
       * @private
       */
      _onFileDeletedAttachment: function (oObjectToDelete) {
        var oModel = this.getODataModel(),
          sPath =
            "/" +
            oModel.createKey("DocumentAttachment", {
              DocumentId: oObjectToDelete.DocumentId,
              ObjectNumber: oObjectToDelete.ObjectNumber,
              ObjectCode: oObjectToDelete.ObjectCode,
              ObjectYear: oObjectToDelete.ObjectYear,
            });

        this._oDetailModel.setProperty("/busyAttachmentsList", true);

        oModel.remove(sPath, {
          groupId: "DeleteAttachment",
          success: function (oData) {
            this._refreshAttachmentBinding();
          }.bind(this),
          error: function (oError) {
            this._refreshAttachmentBinding();
            //Display error message
            this.handleErrorMessage(this.determineODataErrorText(oError));
          }.bind(this),
        });
      },

      /**
       * Set the full screen mode to false and navigate to list page
       */
      onCloseDetailPress: function () {
        this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
        // No item should be selected on list after detail page is closed
        this.getOwnerComponent().oListSelector.clearMasterListSelection();
        this.getRouter().navTo("master");
      },

      /**
       * Toggle between full and non full screen mode.
       */
      toggleFullScreen: function () {
        var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
        this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
        if (!bFullScreen) {
          // store current layout and go full screen
          this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
          this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
        } else {
          // reset to previous layout
          this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
        }
      },
      processFlowApprovalDate: function (sApprovalDate, oTime) {
        var ret = null,
          oI18n = this.getResourceBundle(),
          oDateFormat = DateFormat.getDateTimeInstance({
            pattern: "dd/MM/yy HH:mm",
            UTC: true,
          }),
          oSplitTime,
          oTimeLineDateTime,
          sDateFormated;

        if (sApprovalDate !== null) {
          ret = "";
          oSplitTime = this.formatter.msToTime(oTime.ms);
          oTimeLineDateTime = this.formatter.timeLineDateTime(sApprovalDate, oSplitTime);
          sDateFormated = oDateFormat.format(new Date(oTimeLineDateTime));

          ret = oI18n.getText("Detail.Section.ApprovalStep.validatedOn") + " " + sDateFormated;
        }

        return ret;
      },
      onZoomIn: function () {
        var oProcessFlow = this.byId("processflow");

        oProcessFlow.zoomIn();
      },

      onZoomOut: function () {
        var oProcessFlow = this.byId("processflow");

        oProcessFlow.zoomOut();
      },
      onResreshProcessWf: function () {
        var oProcessFlow = this.byId("processflow");
        //oProcessFlow.updateModel();
        oProcessFlow.getBinding("lanes").refresh();
        oProcessFlow.getBinding("nodes").refresh();
      },

      // onPressSave: function () {
      //   this._oDetailModel.setProperty("/validateButtonPressed", true);
      //   // this._oDetailModel.setProperty("/saveButtonPressed", true);
      //   this._onCommentDisplay();
      // },

      onPressValidate: function () {
        this._oDetailModel.setProperty("/validateButtonPressed", true);
        this._onCommentDisplay();
      },

      onPressReject: function () {
        this._oDetailModel.setProperty("/rejectButtonPressed", true);
        this._onCommentDisplay();
      },

      //Active or not the save button (because comment is mandatory)
      onCommentTextLiveChange: function (oEvent) {
        var sText = oEvent.getParameter("value"),
          bMandatory = this._oDetailModel.getProperty("/validateButtonPressed");

        this._oDetailModel.setProperty("/comment/beginEnabled", sText.length > 0 || !bMandatory);
      },

      onCommentPress: function () {
        this._oDetailModel.setProperty("/addCommentButtonPressed", true);
        this._onCommentDisplay();
      },

      //Click on Send button
      onCommentBeginPress: function () {
        var sPath = this.getView().getElementBinding().getPath(),
          //oNextItem = this.getOwnerComponent().oListSelector.findNextItem(sPath),
          //oEventBus = sap.ui.getCore().getEventBus(),
          oAppViewModel = this.getModel("appView"),
          sBindingPath = this.getView().getBindingContext().getPath(),
          oBindingObject = this.getView().getBindingContext().getObject(sBindingPath, {
            expand: "to_DocumentItem",
          }),
          sText = this._oDetailModel.getProperty("/comment/value"),
          aText = sText.split("\n"),
          aComments = [],
          aSentences = [""],
          iStrLn = 0,
          iSentence = 0,
          aItemsToValidate = [],
          sApproveItemsPath = "";

        if (sText) {
          aText.forEach(function (sTxt, iIdx) {
            var aWords = sTxt.split(" ");

            //Each elem of aText is separated by \n, so we keep the new line info
            if (iIdx > 0) {
              iSentence += 1;
              aSentences[iSentence] = "";
            }

            //For each word
            aWords.forEach(function (sWord, iIndex) {
              var aTmpSplit;

              //Check if current sentence + new word > 130 chars
              iStrLn = aSentences[iSentence].length + sWord.length;
              //If to long, begin a new sentence.
              if (iStrLn > 130) {
                iSentence += 1;
                aSentences[iSentence] = "";
              }

              //If not to long or new sentence, continue
              aSentences[iSentence] = aSentences[iSentence] + sWord + " ";

              //If word length > 130chars, we split it
              if (aSentences[iSentence].length > 130) {
                aTmpSplit = aSentences[iSentence].match(/.{1,130}/g);
                aTmpSplit.forEach(function (sTmpStr) {
                  aSentences[iSentence] = sTmpStr;
                  if (sTmpStr.length === 130) {
                    iSentence += 1;
                    aSentences[iSentence] = "";
                  }
                });
              }
            });
          });

          //Create object to send to backend (comments)
          aSentences.forEach(function (sTextLine, iIndex) {
            aComments.push({
              DocumentId: oBindingObject.DocumentId,
              TextId: "" + iIndex,
              TextObject: sTextLine,
              LogDate: new Date(),
            });
          });
        }

        oAppViewModel.setProperty("/busy", true);

        //Comments button pressed
        if (this._oDetailModel.getProperty("/addCommentButtonPressed")) {
          //Call service to add comment
          this.getODataModel().create(
            "/AddComment",
            {
              DocumentId: oBindingObject.DocumentId,
              to_DocumentComment: aComments,
            },
            {
              success: function (response) {
                this.getODataModel().refresh(true);
                // this.byId("timelineId").getBinding("content").refresh();
                oAppViewModel.setProperty("/busy", false);
                MessageToast.show(this.getResourceBundle().getText("Detail.comment.SuccessMessage"));
              }.bind(this),

              error: function (oAddCommentError) {
                oAppViewModel.setProperty("/busy", false);
                MessageBox.error(this.determineODataErrorText(oAddCommentError));
              }.bind(this),
            }
          );
        }

        //Validate button pressed
        if (this._oDetailModel.getProperty("/validateButtonPressed")) {
          //Get items
          oBindingObject.to_DocumentItem.forEach(
            function (oItem) {
              if (oItem.ItemBlocked) {
                aItemsToValidate.push({
                  DocumentId: oItem.DocumentId,
                  DocumentItemId: oItem.DocumentItemId,
                  ToApprove: oItem.ToApprove,
                });
              }
            }.bind(this)
          );

          //Call service according to role
          this.getODataModel().create(
            "/ApproveItems",
            {
              DocumentId: oBindingObject.DocumentId,
              to_DocumentComment: aComments,
              to_DocumentItem: aItemsToValidate,
            },
            {
              success: function (response) {
                // if (this.getODataModel().hasPendingChanges()) {
                // 	this.getODataModel().resetChanges();
                // }
                MessageToast.show(this.getResourceBundle().getText("Detail.approveitems.SuccessMessage"));
                oAppViewModel.setProperty("/busy", false);
                //oEventBus.publish("Detail", "NavTo", "");
                this.getRouter().navTo("master");
              }.bind(this),

              error: function (oValidateError) {
                oAppViewModel.setProperty("/busy", false);
                MessageBox.error(this.determineODataErrorText(oValidateError));
              }.bind(this),
            }
          );
        } else if (this._oDetailModel.getProperty("/rejectButtonPressed")) {
          let sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
            LogComment = this.getView().getModel("detailView").getProperty("/comment/value"),
            oAppModel = this.getModel("appView");

          oAppModel.setProperty("/busy", true);

          let oRejectedInvoice = {
            DocumentId: sDocumentId,
            LogComment: LogComment,
            to_DocumentComment: aComments,
          };

          this.getODataModel().create("/ActionReject", oRejectedInvoice, {
            success: (oValidateSuccess) => {
              let sError = "";
              let sSuccess = "";

              oValidateSuccess.to_Document.results.forEach((oDocumentReturn) => {
                if (oDocumentReturn.to_Message && oDocumentReturn.to_Message.results) {
                  oDocumentReturn.to_Message.results.forEach((oMessage) => {
                    if (oMessage.MessageType === "E") {
                      if (sError) {
                        sError += "\n";
                      }
                      sError += oMessage.ReturnMessage;
                    } else if (oMessage.MessageType === "S") {
                      if (sSuccess) {
                        sSuccess += "\n";
                      }
                      sSuccess += oMessage.ReturnMessage;
                    }
                  });
                }
              });

              //Release app
              oAppModel.setProperty("/busy", false);
              this.getODataModel().refresh(true);
              this.getRouter().navTo("master");
              this.getOwnerComponent().getEventBus().publish("Master", "RefreshList");

              //In case of error, display them
              if (sError) {
                this.handleErrorMessage(sError);
              } else {
                this.handleSuccessMessage(sSuccess);
              }
            },
            error: (oValidateError) => {
              this.handleErrorMessage(this.determineODataErrorText(oValidateError));
              oAppModel.setProperty("/busy", false);
            },
          });
        }

        //Clear comments in view model
        this._refreshViewModel();

        this._oCommentDialog.close();
      },

      //Click on Cancel on comment popup
      onCommentEndPress: function () {
        //Clear agents and comments in view model
        this._refreshViewModel();
        this._oCommentDialog.close();
      },

      //Refresh View Model
      _refreshViewModel: function () {
        this._oDetailModel.setProperty("/comment", {
          value: "",
          beginEnabled: false,
          warningVisible: false,
          mandatory: true,
        });

        this._oDetailModel.setProperty("/validateButtonPressed", false);
        this._oDetailModel.setProperty("/addCommentButtonPressed", false);
        this._oDetailModel.setProperty("/rejectButtonPressed", false);
      },

      /*** Init models ***/

      _initDetailModel: function () {
        this._oDetailModel.setProperty("/", {
          busy: false,
          busyAttachmentsList: false,
          serviceUrl: "",
          approvalSteps: [],
          approvalStepsVisible: false,
          newComment: "",
          aGlobalDocumentTypes: [], //for Archivelink attachment
          sSelectedDocumentType: "", //for Archivelink attachment
          aAuthorizedExtension: [""], //for Archivelink attachment
          oAttachemntMode: {},
          comment: {
            value: "",
            beginEnabled: false,
            warningVisible: false,
            mandatory: true,
          },
          validateButtonPressed: false,
          addCommentButtonPressed: false,
          rejectButtonPressed: false,
        });
      },

      /**
       * Retrive approval steps from GetApprovalSteps function import
       * @private
       */
      _callGetApprovalSteps: function () {
        var oAppModel = this.getModel("appView"),
          oBindedObject = this.getView().getBindingContext().getObject(),
          oModel = this.getODataModel(),
          oProcessFlow = this.byId("processflow");

        //Reset approvalSteps in detail model
        this._oDetailModel.setProperty("/approvalSteps", []);

        oProcessFlow.setZoomLevel("One");
        //oProcessFlow.updateModel();
        oProcessFlow.removeAllNodes();
        oProcessFlow.removeAllLanes();

        //oAppModel.setProperty("/busy", true);
        this._oDetailModel.setProperty("/busy", true);

        oModel.callFunction("/GetApprovalSteps", {
          method: "GET",
          groupId: "Test",
          urlParameters: {
            DocumentId: oBindedObject.DocumentId,
          },
          success: function (oSuccessData) {
            //oAppModel.setProperty("/busy", false);
            this._oDetailModel.setProperty("/busy", false);
            this._oDetailModel.setProperty("/approvalSteps", oSuccessData.results);

            // Avoid blinking title section
            if (oSuccessData.results.length > 0) {
              this._oDetailModel.setProperty("/approvalStepsVisible", true);
            } else {
              this._oDetailModel.setProperty("/approvalStepsVisible", false);
            }
          }.bind(this),
          error: function (oError) {
            //oAppModel.setProperty("/busy", false);
            this._oDetailModel.setProperty("/busy", false);
            this._oDetailModel.setProperty("/approvalStepsVisible", false);
            this.handleErrorMessage(this.determineODataErrorText(oError));
          }.bind(this),
        });

        //this.byId("processflow").updateModel();
      },
      _refreshAttachmentBinding: function () {
        var oBinding,
          oUploadSet = this.byId("attachmentUploadSet");

        oBinding = oUploadSet.getBinding("items");
        oBinding.attachEventOnce(
          "dataReceived",
          function () {
            this._oDetailModel.setProperty("/busyAttachmentsList", false);
          }.bind(this)
        );
        oBinding.refresh();
      },

      _refreshGlobDocTypeBinding: function () {
        var oBinding,
          oUploadSet = this.byId("attachmentUploadSet");

        oBinding = oUploadSet.getBinding("items");
        oBinding.attachEventOnce(
          "dataReceived",
          function () {
            this._oDetailModel.setProperty("/busyAttachmentsList", false);
          }.bind(this)
        );
        oBinding.refresh();
      },

      _onCommentDisplay: function () {
        var bWarning,
          bMandatory,
          bValidButton = this._oDetailModel.getProperty("/validateButtonPressed"),
          sBindingPath = this.getView().getBindingContext().getPath(),
          oBindingObject = this.getView().getBindingContext().getObject(sBindingPath, {
            expand: "to_DocumentItem",
          });

        //Clear current comment
        this._oDetailModel.setProperty("/comment/value", "");

        //When validate button pressed and at least one item in dispute, display warning
        if (
          bValidButton &&
          oBindingObject.to_DocumentItem.some(function (oItem) {
            return oItem.ItemBlocked && !oItem.ToApprove;
          })
        ) {
          bWarning = true;
          bMandatory = true;
        }

        //When validate button pressed and no item in dispute, hide warning and comment is optionnal
        else if (bValidButton) {
          bWarning = false;
          bMandatory = false;
        }

        //When press Comment button, comment is mandatory and no warning is shown
        else {
          bWarning = false;
          bMandatory = true;
        }

        this._oDetailModel.setProperty("/comment/mandatory", bMandatory);
        this._oDetailModel.setProperty("/comment/beginEnabled", !bMandatory);
        this._oDetailModel.setProperty("/comment/warningVisible", bWarning);

        if (!this._oCommentDialog) {
          Fragment.load({
            name: "fr.applium.afl.aflapprovaldisc.view.fragment.CommentDialog",
            id: this.getView().getId(),
            controller: this,
          }).then((oDialog) => {
            this._oCommentDialog = oDialog;
            this.getView().addDependent(this._oCommentDialog);
            this._oCommentDialog.open();
          });
        } else {
          this._oCommentDialog.open();
        }
      },
    });
  }
);

// sap.ui.define(
//   [
//     "./BaseController",
//     "sap/ui/model/json/JSONModel",
//     "sap/ui/core/Fragment",
//     "sap/m/library",
//     "sap/ui/model/Sorter",
//     "sap/m/SearchField",
//     "sap/m/Label",
//     "sap/m/ColumnListItem",
//     "sap/ui/model/Filter",
//     "sap/ui/model/FilterOperator",
//     "sap/m/MessageBox",
//     "sap/base/util/deepClone",
//     "sap/base/util/deepEqual",
//     "../model/formatter",
//     "sap/m/PDFViewer",
//     "sap/m/MessageBox",
//     "sap/ui/core/Item",
//     "sap/ui/core/format/DateFormat",
//     "sap/ui/Device",
//     "sap/m/MessageToast"
//   ],
//   function (
//     BaseController,
//     JSONModel,
//     Fragment,
//     mobileLibrary,
//     Sorter,
//     SearchField,
//     Label,
//     ColumnListItem,
//     Filter,
//     FilterOperator,
//     MessageBox,
//     deepClone,
//     deepEqual,
//     formatter,
//     PDFViewer,
//     MessageBox,
//     Item,
//     DateFormat,
//     Device,
//     MessageToast
//   ) {
//     "use strict";

//     return BaseController.extend("fr.applium.afl.aflapprovaldisc.controller.Detail", {
//       formatter: formatter,
//       _oVHDialogs: {},

//       /* =========================================================== */
//       /* lifecycle methods                                           */
//       /* =========================================================== */

//       onInit: function () {
//         // Control state model
//         this._oDetailModel = new JSONModel({});
//         this.setModel(this._oDetailModel, "detailView");
//         this._initDetailModel();

//         //Every time user changes items, check if there are changes
//         this._oDetailModel.attachPropertyChange((oEvent) => {
//           var oContext = oEvent.getParameter("context");
//           if (oContext && oContext.getPath().split("/")[1] === "documentItems") {
//             this._checkUpdates();
//           }
//         });

//         this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
//         this.getRouter().getRoute("pdf").attachPatternMatched(this._onObjectMatched, this);

//         this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
//       },

//       onExit: function () {
//         var oFragment;

//         if (this._oCommentDialog) {
//           this._oCommentDialog.destroy();
//           delete this._oCommentDialog;
//         }

//         for (oFragment in this._oVHDialogs) {
//           if (oFragment && oFragment.destroy) {
//             oFragment.destroy();
//           }
//         }
//       },

//       /* =========================================================== */
//       /* event handlers                                              */
//       /* =========================================================== */

//       onPressShowPDF: function (oEvent) {
//         this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
//         this.getRouter().navTo("pdf", {
//           objectId: oEvent.getSource().getBindingContext().getProperty("DocumentId"),
//         });
//       },

//       onPressShowAvoirPDF: function (oEvent) {
//         this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
//         this.getRouter().navTo("pdf", {
//           objectId: oEvent.getSource().getParent().getAggregation("cells")[0].getProperty("title"),
//           // lastDoc : oEvent.getSource().getBindingContext().getProperty("DocumentId")
//         });
//       },

//       onPostComment: function (oEvent) {
//         var sComment = this._oDetailModel.getProperty("/newComment"),
//           sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
//           oCommentDate = new Date();

//         this.getODataModel().create("/DocumentComment", {
//           DocumentId: sDocumentId,
//           LogDate: oCommentDate,
//           LogDatetime: oCommentDate,
//           LogComment: sComment,
//         });
//       },

//       onValueHelpRequestVHImputationCenter: function (oEvent) {
//         var aSorters = [new Sorter("ImputationCenter")],
//           aFilters = [],
//           aCols = [
//             {
//               label: "{/#VHImputationCenterType/ImputationCenter/@sap:label}",
//               template: "ImputationCenter",
//               width: "auto",
//             },
//             {
//               label: "{/#VHImputationCenterType/ImputationCenterName/@sap:label}",
//               template: "ImputationCenterName",
//               width: "auto",
//             },
//           ];

//         this._sDocumentItemPath = oEvent.getSource().getBindingContext("detailView").getPath();

//         this._loadVH({
//           fragmentId: "VHImputationCenter",
//           bindingPath: "/VHImputationCenter",
//           filters: aFilters,
//           sorters: aSorters,
//           columns: aCols,
//           search: true,
//         });
//       },

//       onSuggestVHImputationCenter: function (oEvent) {
//         var sSearchQuery = oEvent.getParameter("suggestValue"),
//           oInput = oEvent.getSource(),
//           oBindingInfo = oInput.getBindingInfo("suggestionRows");

//         if (!oBindingInfo.parameters) {
//           oBindingInfo.parameters = {};
//         }

//         if (!oBindingInfo.parameters.custom) {
//           oBindingInfo.parameters.custom = {};
//         }

//         oBindingInfo.parameters.custom.search = sSearchQuery;

//         oInput.bindAggregation("suggestionRows", oBindingInfo);
//       },

//       onSuggestionItemSelectedVHImputationCenter: function (oEvent) {
//         var sRow = oEvent.getParameter("selectedRow"),
//           sImputationCenter = sRow.getBindingContext().getObject().ImputationCenter;

//         this._oDetailModel.setProperty(this._sDocumentItemPath + "/ImputationCenter", sImputationCenter);
//       },

//       onSearchVHImputationCenter: function (oEvent) {
//         var sSearchQuery = oEvent.getSource().getBasicSearchValue();

//         this._searchVH({
//           fragmentId: "VHImputationCenter",
//           search: sSearchQuery,
//         });
//       },

//       onSearchVHUsersRoles: function (oEvent) {
//         var sSearchQuery = oEvent.getSource().getBasicSearchValue();

//         this._searchVH({
//           fragmentId: "VHUsersRoles",
//           filters: [
//             new Filter({
//               filters: [
//                 new Filter({
//                   path: "LastName",
//                   operator: FilterOperator.Contains,
//                   value1: sSearchQuery
//                     .toUpperCase()
//                     .normalize("NFD")
//                     .replace(/[\u0300-\u036f]/g, ""),
//                 }),
//                 new Filter({
//                   path: "FirstName",
//                   operator: FilterOperator.Contains,
//                   value1: sSearchQuery
//                     .toUpperCase()
//                     .normalize("NFD")
//                     .replace(/[\u0300-\u036f]/g, ""),
//                 }),
//                 new Filter({
//                   path: "UserId",
//                   operator: FilterOperator.Contains,
//                   value1: sSearchQuery
//                     .toUpperCase()
//                     .normalize("NFD")
//                     .replace(/[\u0300-\u036f]/g, ""),
//                 }),
//               ],
//               and: false,
//             }),
//           ],
//         });
//       },

//       onOkVHImputationCenter: function () {
//         var oItemSelected;

//         this._oVHDialogs["VHImputationCenter"].getTableAsync().then((oTable) => {
//           //Desktop
//           if (oTable.bindRows) {
//             oItemSelected = oTable.getContextByIndex(oTable.getSelectedIndex()).getObject();
//           }
//           //Mobile
//           else if (oTable.bindItems) {
//             oItemSelected = oTable.getSelectedItem().getBindingContext().getObject();
//           }

//           this._oDetailModel.setProperty(this._sDocumentItemPath + "/ImputationCenter", oItemSelected.ImputationCenter);
//           // this._oDetailModel.setProperty(this._sDocumentItemPath + "/to_ValueStates/ImputationCenter", "None");

//           this._oVHDialogs["VHImputationCenter"].close();
//         });
//       },

//       onOkVHUsersRoles: function (oEvent) {
//         var aTokens = oEvent.getParameter("tokens"),
//           aUsers = [];

//         aTokens.forEach((oToken) => {
//           aUsers.push({
//             UserId: oToken.getKey(),
//           });
//         });

//         if (aUsers.length === 0) {
//           MessageBox.error(this.getResourceBundle().getText("Detail.UsersVH.AtLeastOne"));
//         } else {
//           //this._referDocumentUserVH(aUsers);
//           this._referTo(aUsers);
//           this._oVHDialogs["VHUsersRoles"].close();
//         }
//       },

//       onCancelVHImputationCenter: function () {
//         this._oVHDialogs["VHImputationCenter"].close();
//       },

//       onCancelVHUsersRoles: function () {
//         this._oVHDialogs["VHUsersRoles"].close();
//       },

//       onAfterCloseVHImputationCenter: function () {
//         this._oVHDialogs["VHImputationCenter"].destroy();
//       },

//       onAfterCloseVHUsersRoles: function () {
//         this._oVHDialogs["VHUsersRoles"].destroy();
//       },

//       // onPressAddItem: function () {
//       // 	var aItems = this._oDetailModel.getProperty("/documentItems"),
//       // 		oNewItem = deepClone(this._aOrigItems[0]);

//       // 	oNewItem.AmountInDocCurrency = "";
//       // 	oNewItem.ImputationCenter = "";

//       // 	aItems.push(oNewItem);

//       // 	this._oDetailModel.setProperty("/documentItems", aItems);

//       // 	//Check changes
//       // 	this._checkUpdates();
//       // },

//       // onPressDeleteItem: function (oEvent) {
//       // 	var oItem = oEvent.getParameter("listItem"),
//       // 		sPath = oItem.getBindingContext("detailView").getPath(),
//       // 		aItems = this._oDetailModel.getProperty("/documentItems");

//       // 	aItems.splice(parseInt(sPath.split("/").pop(), 10), 1);
//       // 	this._oDetailModel.setProperty("/documentItems", aItems);

//       // 	//Calculate sold
//       // 	this._calculateSold();

//       // 	//Check changes
//       // 	this._checkUpdates();
//       // },

//       /**
//        * Set the full screen mode to false and navigate to master page
//        */
//       onPressCloseDetail: function () {
//         // No item should be selected on master after detail page is closed
//         this.getOwnerComponent().oListSelector.clearMasterListSelection();
//         this.getRouter().navTo("master");
//       },

//       /**
//        * Toggle between full and non full screen mode.
//        */
//       onPressFullScreen: function () {
//         var oAppViewModel = this.getModel("appView"),
//           sLayout = oAppViewModel.getProperty("/layout");
//         if (sLayout === "TwoColumnsMidExpanded") {
//           oAppViewModel.setProperty("/layout", "MidColumnFullScreen");
//         } else {
//           oAppViewModel.setProperty("/layout", "TwoColumnsMidExpanded");
//         }
//       },

//       // onLiveChangeAmountInDocCurrency: function (oEvent) {
//       // 	var oBC = oEvent.getSource().getBindingContext("detailView"),
//       // 		oItem = oBC.getObject(),
//       // 		sPath = oBC.getPath();

//       // 	if (oItem.AmountInDocCurrency === "") {
//       // 		oItem.to_ValueStates.AmountInDocCurrency = "Error";
//       // 	} else if (oItem.AmountInDocCurrency < 0) {
//       // 		oItem.to_ValueStates.AmountInDocCurrency = "Error";
//       // 	} else {
//       // 		oItem.to_ValueStates.AmountInDocCurrency = "None";
//       // 	}
//       // 	this._sDocumentItemPath = oEvent.getSource().getBindingContext().getPath();

//       // 	this._oDetailModel.setProperty(sPath, oItem);
//       // 	this._calculateSold();
//       // },

//       // onLiveChangeImputationCenter: function (oEvent) {
//       // 	var oBC = oEvent.getSource().getBindingContext("detailView"),
//       // 		oItem = oBC.getObject(),
//       // 		sPath = oBC.getPath();

//       // 	if (!oItem.ImputationCenter) {
//       // 		oItem.to_ValueStates.ImputationCenter = "Error";
//       // 	} else {
//       // 		oItem.to_ValueStates.ImputationCenter = "None";
//       // 	}

//       // 	this._sDocumentItemPath = oEvent.getSource().getBindingContext().getPath();

//       // 	this._oDetailModel.setProperty(sPath, oItem);

//       // },

//       onPressCancel: function () {
//         this._oDetailModel.setProperty("/documentItems", deepClone(this._aOrigItems));
//         this._oDetailModel.setProperty("/changes", false);
//         this._calculateSold();
//       },

//       onPressSave: function () {
//         var oAppModel = this.getModel("appView"),
//           aLocalItems = this._oDetailModel.getProperty("/documentItems"),
//           oVIMDocument = {
//             DocumentId: this.getView().getBindingContext().getObject().DocumentId,
//             to_DocumentItem: [],
//           };

//         if (this._validateInputs()) {
//           aLocalItems.forEach((oLocalItem) => {
//             oVIMDocument.to_DocumentItem.push({
//               DocumentId: oVIMDocument.DocumentId,
//               // AmountInDocCurrency: oLocalItem.AmountInDocCurrency,
//               // ImputationCenter: oLocalItem.ImputationCenter
//             });
//           });

//           oAppModel.setProperty("/busy", true);

//           this.getODataModel().create("/Document", oVIMDocument, {
//             success: (oSaveSuccess) => {
//               //Navigate to next document and refresh master list
//               //this.getView().getElementBinding().refresh(true);
//               this.getODataModel().read("/Document('" + oVIMDocument.DocumentId + "')", {
//                 urlParameters: {
//                   // "$expand" : "to_DocumentType,to_ProvStatus,to_DocumentPDF,to_DocumentItem"
//                   $expand: "to_DocumentItem,to_DocumentComment,to_DocumentPDF",
//                 },
//                 success: (oReadSuccess) => {
//                   oAppModel.setProperty("/busy", false);
//                   this._oDetailModel.setProperty("/changes", false);
//                   //Save item data from OData
//                   this._aOrigItems = deepClone(this._oDetailModel.getProperty("/documentItems"));
//                 },
//                 error: (oReadError) => {
//                   this.handleErrorMessage(this.determineODataErrorText(oReadError));
//                   oAppModel.setProperty("/busy", false);
//                   this._oDetailModel.setProperty("/changes", false);
//                 },
//               });
//             },

//             error: (oSaveError) => {
//               this.handleErrorMessage(this.determineODataErrorText(oSaveError));
//               oAppModel.setProperty("/busy", false);
//               this._oDetailModel.setProperty("/changes", false);
//             },
//             refreshAfterChange: false,
//           });
//         }
//       },

//       onPressReject: function () {
//         var oAppViewModel = this.getModel("appView");

//         //Set current action
//         this._sCurrentAction = "Reject";

//         //Reset comment
//         this._reinitComment();

//         oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/RejectCommentMandatory"));

//         this._onCommentDisplay();
//       },

//       onPressValidate: function () {
//         var oAppViewModel = this.getModel("appView");

//         //Set current action
//         this._sCurrentAction = "Validate";

//         //Reset comment
//         this._reinitComment();

//         oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/ValidateCommentMandatory"));

//         this._onCommentDisplay();
//       },

//       onPressRefer: function () {
//         var oAppViewModel = this.getModel("appView");

//         //Set current action
//         this._sCurrentAction = "Refer";

//         //Reset comment
//         this._reinitComment();

//         oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", true);

//         this._onCommentNeutralDisplay();
//       },

//       onPressTransfer: function () {
//         var oAppViewModel = this.getModel("appView");

//         //Set current action
//         this._sCurrentAction = "Transfer";

//         //Reset comment
//         this._reinitComment();

//         oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", false);

//         this._onCommentNeutralDisplay();
//       },

//       onPressSubmitComment: function () {
//         if (this._oCommentDialog) {
//           this._oCommentDialog.close();
//         }
//         if (this._oCommentDialogNeutral) {
//           this._oCommentDialogNeutral.close();
//         }

//         switch (this._sCurrentAction) {
//           case "Validate":
//             //this._validateDocument();
//             this._massAction("Validate");
//             break;

//           case "Reject":
//             //this._rejectDocument();
//             this._massAction("Reject");
//             break;

//           case "Refer":
//             this._referDocumentUserVH();
//             break;

//           case "Transfer":
//             this._transferDocumentUserVH();
//             break;

//           default:
//         }
//       },

//       onPressItemsLoadFile: function (oEvent) {
//         var oButton = oEvent.getSource();

//         if (!this._oUploadPopover) {
//           Fragment.load({
//             name: "fr.applium.afl.aflapprovaldisc.view.fragment.Upload",
//             id: this.getView().getId(),
//             controller: this,
//           }).then((oPopover) => {
//             this._oUploadPopover = oPopover;
//             this.getView().addDependent(this._oUploadPopover);
//             this._oUploadPopover.openBy(oButton);
//           });
//         } else {
//           this._oUploadPopover.openBy(oButton);
//         }
//       },

//       onPressCancelComment: function () {
//         this._reinitComment();
//         if (this._oCommentDialog) {
//           this._oCommentDialog.close();
//         }
//         if (this._oCommentDialogNeutral) {
//           this._oCommentDialogNeutral.close();
//         }
//       },

//       onChangeFileUploader: function (oEvent) {
//         var oFiles = oEvent.getParameter("files"),
//           oReader = new FileReader(),
//           aItems = [];

//         if (oFiles && oFiles[0]) {
//           oReader.onload = (oFileReaderEvent) => {
//             var sCSV = oFileReaderEvent.target.result,
//               bError = false,
//               oNewItem;
//             sCSV.split("\n").forEach((sLine) => {
//               if (sLine !== "") {
//                 var aLineData = sLine.split(";");
//                 if (aLineData.length !== 2) {
//                   bError = true;
//                 } else {
//                   oNewItem = deepClone(this._aOrigItems[0]);

//                   oNewItem.AmountInDocCurrency = parseFloat(aLineData[0].replace(",", ".")).toFixed(2);
//                   oNewItem.ImputationCenter = aLineData[1].replace(/[^a-zA-Z0-9 /]/g, "");

//                   aItems.push(oNewItem);
//                 }
//               }
//             });

//             if (!bError) {
//               this._oDetailModel.setProperty("/documentItems", aItems);

//               this._oUploadPopover.close();

//               //Calculate sold
//               this._calculateSold();

//               //Check changes
//               this._checkUpdates();

//               //Clear path field to reselect same file
//               this._oDetailModel.setProperty("/csvPath", "");
//             } else {
//               MessageBox.error(this.getResourceBundle().getText("Detail.Items.Upload.ReadImpossible"));

//               //Clear path field to reselect same file
//               this._oDetailModel.setProperty("/csvPath", "");
//             }
//           };
//           oReader.onerror = (sException) => {
//             MessageBox.error(this.getResourceBundle().getText("Detail.Items.Upload.ReadImpossible"));

//             //Clear path field to reselect same file
//             this._oDetailModel.setProperty("/csvPath", "");
//           };
//           oReader.readAsBinaryString(oFiles[0]);
//         }
//       },

//       onTypeMissmatchFileUploader: function () {
//         MessageBox.error(this.getResourceBundle().getText("Detail.Items.Upload.FiletypeMissmatch"));
//       },

//       //### PAGE LAYOUT ACTIONS ###

//       /*** Item with gap Section ***/

//       /**
//        * Navigate to PurchaseOrder App
//        */
//       onPressLinkPurchasingDocument: function (oEvent) {
//         var oPurchasingDocument = oEvent.getSource().getBindingContext().getObject();

//         this._navigateToApp("PurchaseOrder", "display", {
//           PurchaseOrder: oPurchasingDocument.PurchasingDocument,
//           uitype: "advanced",
//         });
//       },

//       /* =========================================================== */
//       /* begin: internal methods                                     */
//       /* =========================================================== */

//       _initDetailModel: function () {
//         this._oDetailModel.setProperty("/", {
//           busy: false,
//           newComment: "",
//           documentItems: [],
//           soldAmount: "",
//           changes: false,
//           saveEnabled: false,
//           validators: [],
//           accountants: [],
//           csvPath: "",
//         });
//       },

//       /**
//        * Binds the view to the object path and expands the aggregated line items.
//        * @function
//        * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
//        * @private
//        */
//       _onObjectMatched: function (oEvent) {
//         var sObjectId = oEvent.getParameter("arguments").objectId,
//           sRouteName = oEvent.getParameter("name");

//         if (sRouteName === "object") {
//           this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
//         }
//         this.getModel()
//           .metadataLoaded()
//           .then(() => {
//             var sObjectPath = this.getModel().createKey("Document", {
//               DocumentId: sObjectId,
//             });

//             //Deactivate master action columns
//             this.getOwnerComponent().getEventBus().publish("Master", "DeactivateColumns");

//             this._bindView("/" + sObjectPath);
//           });
//       },

//       /**
//        * Binds the view to the object path. Makes sure that detail view displays
//        * a busy indicator while data for the corresponding element binding is loaded.
//        * @function
//        * @param {string} sObjectPath path to the object to be bound to the view.
//        * @private
//        */
//       _bindView: function (sObjectPath) {
//         // Set busy indicator during view binding

//         // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
//         this._oDetailModel.setProperty("/busy", false);

//         this.getView().bindElement({
//           path: sObjectPath,
//           parameters: {
//             //
//             // expand: "to_DocumentItem,to_AvoirId,to_DocumentPDF,to_DocumentComment",
//             expand: "to_DocumentItem,to_DocumentPDF",
//           },
//           events: {
//             change: (oEvent) => {
//               this._onBindingChange();
//             },
//             dataRequested: (oEvent) => {
//               this._oDetailModel.setProperty("/busy", true);
//             },
//             dataReceived: (oEvent) => {
//               this._oDetailModel.setProperty("/busy", false);
//             },
//           },
//         });
//       },

//       _onBindingChange: function () {
//         var oView = this.getView(),
//           oVIMDocument = oView.getBindingContext().getObject({
//             // expand: "to_DocumentItem,to_AvoirId,to_DocumentPDF,to_DocumentComment",
//             expand: "to_DocumentItem,to_DocumentPDF",
//             // expand: "to_DocumentItem",
//           }),
//           oElementBinding = oView.getElementBinding(),
//           sPath,
//           aDocumentItems = [];

//         // No data for the binding
//         if (!oElementBinding.getBoundContext()) {
//           this.getRouter().getTargets().display("detailObjectNotFound");
//           // if object could not be found, the selection in the master list
//           // does not make sense anymore.
//           this.getOwnerComponent().oListSelector.clearMasterListSelection();
//           return;
//         }

//         sPath = oElementBinding.getPath();

//         this.getOwnerComponent().oListSelector.selectAListItem(sPath);

//         oVIMDocument.to_DocumentItem.forEach((oDocumentItem) => {
//           // oDocumentItem.to_ValueStates = {
//           //   PurchasingDocument: "None",
//           //   AmountInDocCurrency: "None",
//           //   ImputationCenter: "None",
//           // };
//           aDocumentItems.push(oDocumentItem);
//         });

//         //Get items in local model
//         this._oDetailModel.setProperty("/documentItems", aDocumentItems);

//         //Get credit in local model
//         this._oDetailModel.setProperty("/documentCredits", oVIMDocument.to_AvoirId);

//         //Save item data from OData
//         this._aOrigItems = deepClone(oVIMDocument.to_DocumentItem);

//         //Calculate sold
//         this._calculateSold();

//         //In case of save, check updates with new data
//         this._checkUpdates();
//       },

//       _onMetadataLoaded: function () {
//         // Binding the view will set it to not busy - so the view is always busy if it is not bound
//         this._oDetailModel.setProperty("/busy", true);
//       },

//       /**
//        * Value Help search
//        * @param {object} oParameters - Function parameters
//        * @param {string} oParameters.fragmentId - Fragment ID
//        * @param {array} oParameters.filters - Filters
//        * @param {boolean} oParameters.search - Active search in value Help
//        * @param {array} oParameters.sorters - Sorters
//        * @param {array} oParameters.columns - Columns for value help table
//        * @param {string} oParameters.bindingPath - Binding path for value help table
//        * @function
//        * @private
//        */
//       _loadVH: function (oParameters) {
//         var sSearchValue = this._oDetailModel.getProperty(this._sDocumentItemPath + "/ImputationCenter"),
//           oBasicSearchField = new SearchField({
//             value: sSearchValue,
//             search: () => {
//               this._oVHDialogs[oParameters.fragmentId].getFilterBar().fireSearch();
//             },
//           });
//         Fragment.load({
//           name: "fr.applium.afl.aflapprovaldisc.view.fragment." + oParameters.fragmentId,
//           id: this.getView().getId(),
//           controller: this,
//         }).then((oDialog) => {
//           var oEvents = {
//             dataRequested: () => {
//               this.getModel("appView").setProperty("/busyVH", true);
//             },

//             dataReceived: () => {
//               this._oVHDialogs[oParameters.fragmentId].update();
//               this.getModel("appView").setProperty("/busyVH", false);
//             },

//             change: () => {
//               this._oVHDialogs[oParameters.fragmentId].update();
//             },
//           };

//           this._oVHDialogs[oParameters.fragmentId] = oDialog;
//           this.getView().addDependent(this._oVHDialogs[oParameters.fragmentId]);

//           if (oParameters.search) {
//             this._oVHDialogs[oParameters.fragmentId].getFilterBar().setBasicSearch(oBasicSearchField);
//           }

//           this._oVHDialogs[oParameters.fragmentId].getTableAsync().then((oTable) => {
//             oTable.setModel(this.getODataModel());
//             oTable.setModel(
//               new JSONModel({
//                 cols: oParameters.columns,
//               }),
//               "columns"
//             );

//             if (oTable.bindRows) {
//               oTable.bindAggregation("rows", {
//                 path: oParameters.bindingPath,
//                 filters: oParameters.filters,
//                 sorter: oParameters.sorters,
//                 parameters: oParameters.parameters,
//                 events: oEvents,
//               });
//             }

//             if (oTable.bindItems) {
//               //Fix to set width in mobile
//               oTable.getAggregation("columns").forEach((oColumn, iIndex) => {
//                 if (oParameters.columns[iIndex] && oParameters.columns[iIndex].width) {
//                   oColumn.setWidth(oParameters.columns[iIndex].width);
//                 }

//                 if (oParameters.columns[iIndex] && oParameters.columns[iIndex].minScreenWidth) {
//                   oColumn.setMinScreenWidth(oParameters.columns[iIndex].minScreenWidth);
//                 }

//                 if (oParameters.columns[iIndex] && oParameters.columns[iIndex].demandPopin) {
//                   oColumn.setDemandPopin(oParameters.columns[iIndex].demandPopin);
//                 }
//               });
//               oTable.bindAggregation("items", {
//                 path: oParameters.bindingPath,
//                 filters: oParameters.filters,
//                 sorter: oParameters.sorters,
//                 events: oEvents,
//                 factory: () => {
//                   var aCells = [];
//                   oParameters.columns.forEach((oCol) => {
//                     aCells.push(
//                       new Label({
//                         text: "{" + oCol.template + "}",
//                       })
//                     );
//                   });
//                   return new ColumnListItem({
//                     cells: aCells,
//                   });
//                 },
//               });
//             }

//             if (sSearchValue) {
//               this._searchVH({
//                 fragmentId: oParameters.fragmentId,
//                 search: sSearchValue,
//               });
//             }

//             this._oVHDialogs[oParameters.fragmentId].open();
//           });
//         });
//       },

//       /**
//        * Value Help search
//        * @param {object} oParameters - Function parameters
//        * @param {string} oParameters.fragmentId - Fragment ID
//        * @param {string} oParameters.search - Search string
//        * @param {array} oParameters.filters - Filters to apply
//        * @function
//        * @private
//        */
//       _searchVH: function (oParameters) {
//         var oFilter;

//         //Search management
//         this._oVHDialogs[oParameters.fragmentId].getTableAsync().then((oTable) => {
//           var oBindingInfo, sAggregation;
//           if (oTable.bindRows) {
//             sAggregation = "rows";
//           }

//           if (oTable.bindItems) {
//             sAggregation = "items";
//           }

//           if (oParameters.search !== undefined) {
//             oBindingInfo = oTable.getBindingInfo(sAggregation);

//             if (!oBindingInfo.parameters) {
//               oBindingInfo.parameters = {};
//             }

//             if (!oBindingInfo.parameters.custom) {
//               oBindingInfo.parameters.custom = {};
//             }

//             oBindingInfo.parameters.custom.search = oParameters.search;

//             oTable.bindAggregation(sAggregation, oBindingInfo);
//           }

//           //Filter management
//           else if (oParameters.filters) {
//             oFilter = new Filter({
//               filters: oParameters.filters,
//               and: true,
//             });

//             oTable.getBinding(sAggregation).filter(oFilter);
//           }

//           this._oVHDialogs[oParameters.fragmentId].update();
//         });
//       },

//       _calculateSold: function () {
//         var aItems = this._oDetailModel.getProperty("/documentItems"),
//           sNetAmount = this.getView().getBindingContext().getObject().NetAmount,
//           bSaveEnabled = true,
//           fSold = parseFloat(sNetAmount);

//         aItems.forEach((oItem) => {
//           if (oItem.AmountInDocCurrency) {
//             fSold = fSold - parseFloat(oItem.AmountInDocCurrency);
//           }
//           if (oItem.AmountInDocCurrency < 0 || oItem.AmountInDocCurrency === "") {
//             bSaveEnabled = false;
//           }
//         });
//         if (fSold.toFixed(2) === "-0.00") {
//           fSold = 0;
//         }
//         this._oDetailModel.setProperty("/soldAmount", fSold.toFixed(2));
//         if (fSold.toFixed(2) === "0.00" && bSaveEnabled === true) {
//           this._oDetailModel.setProperty("/saveEnabled", true);
//         } else {
//           this._oDetailModel.setProperty("/saveEnabled", false);
//         }
//       },

//       _checkUpdates: function () {
//         var aItems = this._oDetailModel.getProperty("/documentItems");

//         this._oDetailModel.setProperty("/changes", !deepEqual(aItems, this._aOrigItems));
//       },

//       _loadUsersRolesVH: function (sRole) {
//         var aSorters = [new Sorter("UserId")],
//           aFilters = [],
//           aCols = [
//             {
//               label: "{/#VHUsersRoles/UserId/@sap:label}",
//               template: "detailView>UserId",
//               width: "auto",
//             },
//             {
//               label: "{/#VHUsersRoles/LastName/@sap:label}",
//               template: "detailView>LastName",
//               width: "auto",
//             },
//             {
//               label: "{/#VHUsersRoles/FirstName/@sap:label}",
//               template: "detailView>FirstName",
//               width: "auto",
//             },
//           ],
//           sBindingPath = sRole === "Accountants" ? "detailView>/accountants" : "detailView>/validators";

//         this._loadVH({
//           fragmentId: "VHUsersRoles",
//           bindingPath: sBindingPath,
//           filters: aFilters,
//           sorters: aSorters,
//           columns: aCols,
//           search: true,
//         });
//       },

//       _onCommentDisplay: function () {
//         if (!this._oCommentDialog) {
//           Fragment.load({
//             name: "fr.applium.afl.aflapprovaldisc.view.fragment.CommentDialog",
//             id: this.getView().getId(),
//             controller: this,
//           }).then((oDialog) => {
//             this._oCommentDialog = oDialog;
//             this.getView().addDependent(this._oCommentDialog);
//             this._oCommentDialog.open();
//           });
//         } else {
//           this._oCommentDialog.open();
//         }
//       },

//       _onCommentNeutralDisplay: function () {
//         if (!this._oCommentDialogNeutral) {
//           Fragment.load({
//             name: "fr.applium.afl.aflapprovaldisc.view.fragment.CommentDialogNeutral",
//             id: this.getView().getId(),
//             controller: this,
//           }).then((oDialog) => {
//             this._oCommentDialogNeutral = oDialog;
//             this.getView().addDependent(this._oCommentDialogNeutral);
//             this._oCommentDialogNeutral.open();
//           });
//         } else {
//           this._oCommentDialogNeutral.open();
//         }
//       },

//       _transferDocumentUserVH: function () {
//         var oAppModel = this.getModel("appView");

//         oAppModel.setProperty("/busy", true);
//         //Get actors from backend
//         this.getODataModel().callFunction("/GetValidators", {
//           method: "GET",
//           urlParameters: {
//             DocumentId: this.getView().getBindingContext().getObject().DocumentId,
//           },
//           success: (oGetValidatorsSuccess) => {
//             this._oDetailModel.setProperty("/validators", oGetValidatorsSuccess.results);
//             this._loadUsersRolesVH("Validators");
//             oAppModel.setProperty("/busy", false);
//           },
//           error: (oGetValidatorsError) => {
//             oAppModel.setProperty("/busy", false);
//             this.handleErrorMessage(this.determineODataErrorText(oGetValidatorsError));
//           },
//         });
//       },

//       _referDocumentUserVH: function () {
//         var oAppModel = this.getModel("appView");

//         oAppModel.setProperty("/busy", true);

//         this.getODataModel().callFunction("/Response", {
//           method: "GET",
//           urlParameters: {
//             DocumentId: this.getView().getBindingContext().getObject().DocumentId,
//           },
//           success: (oGetResponseSuccess) => {
//             this._oDetailModel.setProperty("/Response", oGetResponseSuccess.results);
//             // this._loadUsersRolesVH("Accountants");
//             oAppModel.setProperty("/busy", false);
//             this.handleSuccessMessage(oGetResponseSuccess.results[0].Message);
//           },
//           error: (oGetResponseError) => {
//             oAppModel.setProperty("/busy", false);
//             this.handleErrorMessage(this.determineODataErrorText(oGetResponseError));
//           },
//         });
//       },

//       _referTo: function (aUsers) {
//         var oAppModel = this.getModel("appView"),
//           oReferTo = {
//             DocumentId: this.getView().getBindingContext().getObject().DocumentId,
//             // ToActor: this._sCurrentAction === "Refer" ? "COMPTABLE" : "VALIDEUR_FACTUR",
//             LogComment: oAppModel.getProperty("/comment/value"),
//             UserId: aUsers[0].UserId,
//           };

//         oAppModel.setProperty("/busy", true);

//         this.getODataModel().callFunction("/Refer", {
//           method: "GET",
//           urlParameters: oReferTo,
//           success: (oReferToSuccess) => {
//             //Navigate to next document and refresh master list
//             // this._navigateToNextDocument();
//             this.getODataModel().refresh(true);
//             this.getRouter().navTo("master");
//             oAppModel.setProperty("/busy", false);
//             this.handleSuccessMessage(oReferToSuccess.results[0].Message);
//           },

//           error: (oReferToError) => {
//             this.handleErrorMessage(this.determineODataErrorText(oReferToError));
//             oAppModel.setProperty("/busy", false);
//           },
//         });
//       },

//       _validateDocument: function () {
//         var sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
//           sComment = this.getModel("appView").getProperty("/comment/value"),
//           oAppModel = this.getModel("appView");

//         oAppModel.setProperty("/busy", true);

//         this.getODataModel().callFunction("/Validate", {
//           method: "POST",
//           groupId: "Validate-" + sDocumentId,
//           urlParameters: {
//             DocumentId: sDocumentId,
//             LogComment: sComment,
//           },
//           success: (oValidateSuccess) => {
//             //Navigate to next document and refresh master list
//             this._navigateToNextDocument();
//             oAppModel.setProperty("/busy", false);
//           },
//           error: (oValidateError) => {
//             this.handleErrorMessage(this.determineODataErrorText(oValidateError));
//             oAppModel.setProperty("/busy", false);
//           },
//         });
//       },

//       _rejectDocument: function () {
//         var sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
//           sComment = this.getModel("appView").getProperty("/comment/value"),
//           oAppModel = this.getModel("appView");

//         oAppModel.setProperty("/busy", true);

//         this.getODataModel().callFunction("/Reject", {
//           method: "POST",
//           groupId: "Reject-" + sDocumentId,
//           urlParameters: {
//             DocumentId: sDocumentId,
//             LogComment: sComment,
//           },
//           success: (oRejectSuccess) => {
//             //Navigate to next document and refresh master list
//             this._navigateToNextDocument();
//             oAppModel.setProperty("/busy", false);
//           },
//           error: (oRejectError) => {
//             this.handleErrorMessage(this.determineODataErrorText(oRejectError));
//             oAppModel.setProperty("/busy", false);
//           },
//         });
//       },

//       _reinitComment: function () {
//         this.getModel("appView").setProperty("/comment", {
//           mandatory: false,
//           value: "",
//           submitEnabled: false,
//         });
//       },

//       _navigateToNextDocument: function () {
//         var oNextDocument,
//           sCurrentPath = this.getView().getElementBinding().getPath(),
//           oNextListItem = this.getOwnerComponent().oListSelector.findNextItem(sCurrentPath);

//         if (oNextListItem) {
//           oNextDocument = oNextListItem.getBindingContext().getObject();

//           //Select next document
//           this.getRouter().navTo("object", {
//             objectId: oNextDocument.DocumentId,
//           });
//         } else {
//           this.getRouter().navTo("master");
//         }

//         // //Refresh master list
//         // this.getOwnerComponent().getEventBus().publish("Master", "RefreshList");
//       },

//       _validateInputs: function () {
//         var aItems = this._oDetailModel.getProperty("/documentItems"),
//           bRetValid = true;
//         // aItems.forEach((oItem) => {
//         // oItem.to_ValueStates.ImputationCenter = oItem.ImputationCenter ? "None" : "Error";
//         // oItem.to_ValueStates.AmountInDocCurrency = oItem.AmountInDocCurrency !== "" ? "None" : "Error";
//         // if (
//         // oItem.to_ValueStates.ImputationCenter === "Error" ||
//         // oItem.to_ValueStates.AmountInDocCurrency === "Error"
//         // ) {
//         // bRetValid = false;
//         // }
//         // });

//         this._oDetailModel.setProperty("/documentItems", aItems);

//         return bRetValid;
//       },

//       _massAction: function (sAction) {
//         var sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
//           oMassAction = {
//             LogComment: this.getModel("appView").getProperty("/comment/value"),
//             to_Document: [],
//           },
//           oAppModel = this.getModel("appView");

//         oAppModel.setProperty("/busy", true);

//         oMassAction.to_Document.push({
//           DocumentId: sDocumentId,
//           to_Message: [],
//         });

//         this.getODataModel().create("/ActionMass" + sAction, oMassAction, {
//           success: (oValidateSuccess) => {
//             let sError = "";
//             let sSuccess = "";

//             oValidateSuccess.to_Document.results.forEach((oDocumentReturn) => {
//               if (oDocumentReturn.to_Message && oDocumentReturn.to_Message.results) {
//                 oDocumentReturn.to_Message.results.forEach((oMessage) => {
//                   if (oMessage.MessageType === "E") {
//                     if (sError) {
//                       sError += "\n";
//                     }
//                     sError += oMessage.ReturnMessage;
//                   } else if (oMessage.MessageType === "S") {
//                     if (sSuccess) {
//                       sSuccess += "\n";
//                     }
//                     sSuccess += oMessage.ReturnMessage;
//                   }
//                 });
//               }
//             });

//             //After Refresh
//             // this.getODataModel().attachEventOnce("requestCompleted", () => {

//             // } else {
//             // 	//Navigate to next document and refresh master list

//             // }

//             //Release app
//             oAppModel.setProperty("/busy", false);
//             // });

//             this.getODataModel().refresh(true);

//             this.getRouter().navTo("master");

//             this.getOwnerComponent().getEventBus().publish("Master", "RefreshList");

//             // this._navigateToNextDocument();

//             //In case of error, display them
//             if (sError) {
//               this.handleErrorMessage(sError);
//             } else {
//               this.handleSuccessMessage(sSuccess);
//             }
//           },
//           error: (oValidateError) => {
//             this.handleErrorMessage(this.determineODataErrorText(oValidateError));
//             oAppModel.setProperty("/busy", false);
//           },
//         });
//       },
//     });
//   }
// );
