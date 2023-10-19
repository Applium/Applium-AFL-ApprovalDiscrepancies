sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/model/Sorter",
    "sap/m/SearchField",
    "sap/m/Label",
    "sap/m/ColumnListItem",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/base/util/deepClone",
    "sap/base/util/deepEqual",
    "../model/formatter",
  ],
  function (
    BaseController,
    JSONModel,
    Fragment,
    Sorter,
    SearchField,
    Label,
    ColumnListItem,
    Filter,
    FilterOperator,
    MessageBox,
    deepClone,
    deepEqual,
    formatter
  ) {
    "use strict";

    return BaseController.extend("fr.applium.afl.aflapproval.controller.Detail", {
      formatter: formatter,
      _oVHDialogs: {},

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      onInit: function () {
        // Control state model
        this._oDetailModel = new JSONModel({});
        this.setModel(this._oDetailModel, "detailView");
        this._initDetailModel();

        //Every time user changes items, check if there are changes
        this._oDetailModel.attachPropertyChange((oEvent) => {
          var oContext = oEvent.getParameter("context");
          if (oContext && oContext.getPath().split("/")[1] === "documentItems") {
            this._checkUpdates();
          }
        });

        this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
        this.getRouter().getRoute("pdf").attachPatternMatched(this._onObjectMatched, this);

        this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
      },

      onExit: function () {
        var oFragment;

        if (this._oCommentDialog) {
          this._oCommentDialog.destroy();
          delete this._oCommentDialog;
        }

        for (oFragment in this._oVHDialogs) {
          if (oFragment && oFragment.destroy) {
            oFragment.destroy();
          }
        }
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      onPressShowPDF: function (oEvent) {
        this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
        this.getRouter().navTo("pdf", {
          objectId: oEvent.getSource().getBindingContext().getProperty("DocumentId"),
        });
      },

      onPressShowAvoirPDF: function (oEvent) {
        this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
        this.getRouter().navTo("pdf", {
          objectId: oEvent.getSource().getParent().getAggregation("cells")[0].getProperty("title"),
          // lastDoc : oEvent.getSource().getBindingContext().getProperty("DocumentId")
        });
      },

      onPostComment: function (oEvent) {
        var sComment = this._oDetailModel.getProperty("/newComment"),
          sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
          oCommentDate = new Date();

        this.getODataModel().create("/DocumentComment", {
          DocumentId: sDocumentId,
          LogDate: oCommentDate,
          LogDatetime: oCommentDate,
          LogComment: sComment,
        });
      },

      onValueHelpRequestVHImputationCenter: function (oEvent) {
        var aSorters = [new Sorter("ImputationCenter")],
          aFilters = [],
          aCols = [
            {
              label: "{/#VHImputationCenterType/ImputationCenter/@sap:label}",
              template: "ImputationCenter",
              width: "auto",
            },
            {
              label: "{/#VHImputationCenterType/ImputationCenterName/@sap:label}",
              template: "ImputationCenterName",
              width: "auto",
            },
          ];

        this._sDocumentItemPath = oEvent.getSource().getBindingContext("detailView").getPath();

        this._loadVH({
          fragmentId: "VHImputationCenter",
          bindingPath: "/VHImputationCenter",
          filters: aFilters,
          sorters: aSorters,
          columns: aCols,
          search: true,
        });
      },

      onSuggestVHImputationCenter: function (oEvent) {
        var sSearchQuery = oEvent.getParameter("suggestValue"),
          oInput = oEvent.getSource(),
          oBindingInfo = oInput.getBindingInfo("suggestionRows");

        if (!oBindingInfo.parameters) {
          oBindingInfo.parameters = {};
        }

        if (!oBindingInfo.parameters.custom) {
          oBindingInfo.parameters.custom = {};
        }

        oBindingInfo.parameters.custom.search = sSearchQuery;

        oInput.bindAggregation("suggestionRows", oBindingInfo);
      },

      onSuggestionItemSelectedVHImputationCenter: function (oEvent) {
        var sRow = oEvent.getParameter("selectedRow"),
          sImputationCenter = sRow.getBindingContext().getObject().ImputationCenter;

        this._oDetailModel.setProperty(this._sDocumentItemPath + "/ImputationCenter", sImputationCenter);
      },

      onSearchVHImputationCenter: function (oEvent) {
        var sSearchQuery = oEvent.getSource().getBasicSearchValue();

        this._searchVH({
          fragmentId: "VHImputationCenter",
          search: sSearchQuery,
        });
      },

      onSearchVHUsersRoles: function (oEvent) {
        var sSearchQuery = oEvent.getSource().getBasicSearchValue();

        this._searchVH({
          fragmentId: "VHUsersRoles",
          filters: [
            new Filter({
              filters: [
                new Filter({
                  path: "LastName",
                  operator: FilterOperator.Contains,
                  value1: sSearchQuery
                    .toUpperCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, ""),
                }),
                new Filter({
                  path: "FirstName",
                  operator: FilterOperator.Contains,
                  value1: sSearchQuery
                    .toUpperCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, ""),
                }),
                new Filter({
                  path: "UserId",
                  operator: FilterOperator.Contains,
                  value1: sSearchQuery
                    .toUpperCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, ""),
                }),
              ],
              and: false,
            }),
          ],
        });
      },

      onOkVHImputationCenter: function () {
        var oItemSelected;

        this._oVHDialogs["VHImputationCenter"].getTableAsync().then((oTable) => {
          //Desktop
          if (oTable.bindRows) {
            oItemSelected = oTable.getContextByIndex(oTable.getSelectedIndex()).getObject();
          }
          //Mobile
          else if (oTable.bindItems) {
            oItemSelected = oTable.getSelectedItem().getBindingContext().getObject();
          }

          this._oDetailModel.setProperty(this._sDocumentItemPath + "/ImputationCenter", oItemSelected.ImputationCenter);
          // this._oDetailModel.setProperty(this._sDocumentItemPath + "/to_ValueStates/ImputationCenter", "None");

          this._oVHDialogs["VHImputationCenter"].close();
        });
      },

      onOkVHUsersRoles: function (oEvent) {
        var aTokens = oEvent.getParameter("tokens"),
          aUsers = [];

        aTokens.forEach((oToken) => {
          aUsers.push({
            UserId: oToken.getKey(),
          });
        });

        if (aUsers.length === 0) {
          MessageBox.error(this.getResourceBundle().getText("Detail.UsersVH.AtLeastOne"));
        } else {
          //this._referDocumentUserVH(aUsers);
          this._referTo(aUsers);
          this._oVHDialogs["VHUsersRoles"].close();
        }
      },

      onCancelVHImputationCenter: function () {
        this._oVHDialogs["VHImputationCenter"].close();
      },

      onCancelVHUsersRoles: function () {
        this._oVHDialogs["VHUsersRoles"].close();
      },

      onAfterCloseVHImputationCenter: function () {
        this._oVHDialogs["VHImputationCenter"].destroy();
      },

      onAfterCloseVHUsersRoles: function () {
        this._oVHDialogs["VHUsersRoles"].destroy();
      },

      // onPressAddItem: function () {
      // 	var aItems = this._oDetailModel.getProperty("/documentItems"),
      // 		oNewItem = deepClone(this._aOrigItems[0]);

      // 	oNewItem.AmountInDocCurrency = "";
      // 	oNewItem.ImputationCenter = "";

      // 	aItems.push(oNewItem);

      // 	this._oDetailModel.setProperty("/documentItems", aItems);

      // 	//Check changes
      // 	this._checkUpdates();
      // },

      // onPressDeleteItem: function (oEvent) {
      // 	var oItem = oEvent.getParameter("listItem"),
      // 		sPath = oItem.getBindingContext("detailView").getPath(),
      // 		aItems = this._oDetailModel.getProperty("/documentItems");

      // 	aItems.splice(parseInt(sPath.split("/").pop(), 10), 1);
      // 	this._oDetailModel.setProperty("/documentItems", aItems);

      // 	//Calculate sold
      // 	this._calculateSold();

      // 	//Check changes
      // 	this._checkUpdates();
      // },

      /**
       * Set the full screen mode to false and navigate to master page
       */
      onPressCloseDetail: function () {
        // No item should be selected on master after detail page is closed
        this.getOwnerComponent().oListSelector.clearMasterListSelection();
        this.getRouter().navTo("master");
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

      // onLiveChangeAmountInDocCurrency: function (oEvent) {
      // 	var oBC = oEvent.getSource().getBindingContext("detailView"),
      // 		oItem = oBC.getObject(),
      // 		sPath = oBC.getPath();

      // 	if (oItem.AmountInDocCurrency === "") {
      // 		oItem.to_ValueStates.AmountInDocCurrency = "Error";
      // 	} else if (oItem.AmountInDocCurrency < 0) {
      // 		oItem.to_ValueStates.AmountInDocCurrency = "Error";
      // 	} else {
      // 		oItem.to_ValueStates.AmountInDocCurrency = "None";
      // 	}
      // 	this._sDocumentItemPath = oEvent.getSource().getBindingContext().getPath();

      // 	this._oDetailModel.setProperty(sPath, oItem);
      // 	this._calculateSold();
      // },

      // onLiveChangeImputationCenter: function (oEvent) {
      // 	var oBC = oEvent.getSource().getBindingContext("detailView"),
      // 		oItem = oBC.getObject(),
      // 		sPath = oBC.getPath();

      // 	if (!oItem.ImputationCenter) {
      // 		oItem.to_ValueStates.ImputationCenter = "Error";
      // 	} else {
      // 		oItem.to_ValueStates.ImputationCenter = "None";
      // 	}

      // 	this._sDocumentItemPath = oEvent.getSource().getBindingContext().getPath();

      // 	this._oDetailModel.setProperty(sPath, oItem);

      // },

      onPressCancel: function () {
        this._oDetailModel.setProperty("/documentItems", deepClone(this._aOrigItems));
        this._oDetailModel.setProperty("/changes", false);
        this._calculateSold();
      },

      onPressSave: function () {
        var oAppModel = this.getModel("appView"),
          aLocalItems = this._oDetailModel.getProperty("/documentItems"),
          oVIMDocument = {
            DocumentId: this.getView().getBindingContext().getObject().DocumentId,
            to_DocumentItem: [],
          };

        if (this._validateInputs()) {
          aLocalItems.forEach((oLocalItem) => {
            oVIMDocument.to_DocumentItem.push({
              DocumentId: oVIMDocument.DocumentId,
              // AmountInDocCurrency: oLocalItem.AmountInDocCurrency,
              // ImputationCenter: oLocalItem.ImputationCenter
            });
          });

          oAppModel.setProperty("/busy", true);

          this.getODataModel().create("/Document", oVIMDocument, {
            success: (oSaveSuccess) => {
              //Navigate to next document and refresh master list
              //this.getView().getElementBinding().refresh(true);
              this.getODataModel().read("/Document('" + oVIMDocument.DocumentId + "')", {
                urlParameters: {
                  // "$expand" : "to_DocumentType,to_ProvStatus,to_DocumentPDF,to_DocumentItem"
                  $expand: "to_DocumentItem,to_DocumentComment,to_DocumentPDF",
                },
                success: (oReadSuccess) => {
                  oAppModel.setProperty("/busy", false);
                  this._oDetailModel.setProperty("/changes", false);
                  //Save item data from OData
                  this._aOrigItems = deepClone(this._oDetailModel.getProperty("/documentItems"));
                },
                error: (oReadError) => {
                  this.handleErrorMessage(this.determineODataErrorText(oReadError));
                  oAppModel.setProperty("/busy", false);
                  this._oDetailModel.setProperty("/changes", false);
                },
              });
            },

            error: (oSaveError) => {
              this.handleErrorMessage(this.determineODataErrorText(oSaveError));
              oAppModel.setProperty("/busy", false);
              this._oDetailModel.setProperty("/changes", false);
            },
            refreshAfterChange: false,
          });
        }
      },

      onPressReject: function () {
        var oAppViewModel = this.getModel("appView");

        //Set current action
        this._sCurrentAction = "Reject";

        //Reset comment
        this._reinitComment();

        oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

        //determine if comment is mandatory
        oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/RejectCommentMandatory"));

        this._onCommentDisplay();
      },

      onPressValidate: function () {
        var oAppViewModel = this.getModel("appView");

        //Set current action
        this._sCurrentAction = "Validate";

        //Reset comment
        this._reinitComment();

        oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

        //determine if comment is mandatory
        oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/ValidateCommentMandatory"));

        this._onCommentDisplay();
      },

      onPressRefer: function () {
        var oAppViewModel = this.getModel("appView");

        //Set current action
        this._sCurrentAction = "Refer";

        //Reset comment
        this._reinitComment();

        oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

        //determine if comment is mandatory
        oAppViewModel.setProperty("/comment/mandatory", true);

        this._onCommentNeutralDisplay();
      },

      onPressTransfer: function () {
        var oAppViewModel = this.getModel("appView");

        //Set current action
        this._sCurrentAction = "Transfer";

        //Reset comment
        this._reinitComment();

        oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);

        //determine if comment is mandatory
        oAppViewModel.setProperty("/comment/mandatory", false);

        this._onCommentNeutralDisplay();
      },

      onPressSubmitComment: function () {
        if (this._oCommentDialog) {
          this._oCommentDialog.close();
        }
        if (this._oCommentDialogNeutral) {
          this._oCommentDialogNeutral.close();
        }

        switch (this._sCurrentAction) {
          case "Validate":
            //this._validateDocument();
            this._massAction("Validate");
            break;

          case "Reject":
            //this._rejectDocument();
            this._massAction("Reject");
            break;

          case "Refer":
            this._referDocumentUserVH();
            break;

          case "Transfer":
            this._transferDocumentUserVH();
            break;

          default:
        }
      },

      onPressItemsLoadFile: function (oEvent) {
        var oButton = oEvent.getSource();

        if (!this._oUploadPopover) {
          Fragment.load({
            name: "fr.applium.afl.aflapproval.view.fragment.Upload",
            id: this.getView().getId(),
            controller: this,
          }).then((oPopover) => {
            this._oUploadPopover = oPopover;
            this.getView().addDependent(this._oUploadPopover);
            this._oUploadPopover.openBy(oButton);
          });
        } else {
          this._oUploadPopover.openBy(oButton);
        }
      },

      onPressCancelComment: function () {
        this._reinitComment();
        if (this._oCommentDialog) {
          this._oCommentDialog.close();
        }
        if (this._oCommentDialogNeutral) {
          this._oCommentDialogNeutral.close();
        }
      },

      onChangeFileUploader: function (oEvent) {
        var oFiles = oEvent.getParameter("files"),
          oReader = new FileReader(),
          aItems = [];

        if (oFiles && oFiles[0]) {
          oReader.onload = (oFileReaderEvent) => {
            var sCSV = oFileReaderEvent.target.result,
              bError = false,
              oNewItem;
            sCSV.split("\n").forEach((sLine) => {
              if (sLine !== "") {
                var aLineData = sLine.split(";");
                if (aLineData.length !== 2) {
                  bError = true;
                } else {
                  oNewItem = deepClone(this._aOrigItems[0]);

                  oNewItem.AmountInDocCurrency = parseFloat(aLineData[0].replace(",", ".")).toFixed(2);
                  oNewItem.ImputationCenter = aLineData[1].replace(/[^a-zA-Z0-9 /]/g, "");

                  aItems.push(oNewItem);
                }
              }
            });

            if (!bError) {
              this._oDetailModel.setProperty("/documentItems", aItems);

              this._oUploadPopover.close();

              //Calculate sold
              this._calculateSold();

              //Check changes
              this._checkUpdates();

              //Clear path field to reselect same file
              this._oDetailModel.setProperty("/csvPath", "");
            } else {
              MessageBox.error(this.getResourceBundle().getText("Detail.Items.Upload.ReadImpossible"));

              //Clear path field to reselect same file
              this._oDetailModel.setProperty("/csvPath", "");
            }
          };
          oReader.onerror = (sException) => {
            MessageBox.error(this.getResourceBundle().getText("Detail.Items.Upload.ReadImpossible"));

            //Clear path field to reselect same file
            this._oDetailModel.setProperty("/csvPath", "");
          };
          oReader.readAsBinaryString(oFiles[0]);
        }
      },

      onTypeMissmatchFileUploader: function () {
        MessageBox.error(this.getResourceBundle().getText("Detail.Items.Upload.FiletypeMissmatch"));
      },

      /* =========================================================== */
      /* begin: internal methods                                     */
      /* =========================================================== */

      _initDetailModel: function () {
        this._oDetailModel.setProperty("/", {
          busy: false,
          newComment: "",
          documentItems: [],
          soldAmount: "",
          changes: false,
          saveEnabled: false,
          validators: [],
          accountants: [],
          csvPath: "",
        });
      },

      /**
       * Binds the view to the object path and expands the aggregated line items.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
       * @private
       */
      _onObjectMatched: function (oEvent) {
        var sObjectId = oEvent.getParameter("arguments").objectId,
          sRouteName = oEvent.getParameter("name");

        if (sRouteName === "object") {
          this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
        }
        this.getModel()
          .metadataLoaded()
          .then(() => {
            var sObjectPath = this.getModel().createKey("Document", {
              DocumentId: sObjectId,
            });

            //Deactivate master action columns
            this.getOwnerComponent().getEventBus().publish("Master", "DeactivateColumns");

            this._bindView("/" + sObjectPath);
          });
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
        this._oDetailModel.setProperty("/busy", false);

        this.getView().bindElement({
          path: sObjectPath,
          parameters: {
            //
            // expand: "to_DocumentItem,to_AvoirId,to_DocumentPDF,to_DocumentComment",
            expand: "to_DocumentItem,to_DocumentPDF",
          },
          events: {
            change: (oEvent) => {
              this._onBindingChange();
            },
            dataRequested: (oEvent) => {
              this._oDetailModel.setProperty("/busy", true);
            },
            dataReceived: (oEvent) => {
              this._oDetailModel.setProperty("/busy", false);
            },
          },
        });
      },

      _onBindingChange: function () {
        var oView = this.getView(),
          oVIMDocument = oView.getBindingContext().getObject({
            // expand: "to_DocumentItem,to_AvoirId,to_DocumentPDF,to_DocumentComment",
            expand: "to_DocumentItem,to_DocumentPDF",
          }),
          oElementBinding = oView.getElementBinding(),
          sPath,
          aDocumentItems = [];

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

        oVIMDocument.to_DocumentItem.forEach((oDocumentItem) => {
          // oDocumentItem.to_ValueStates = {
          //   PurchasingDocument: "None",
          //   AmountInDocCurrency: "None",
          //   ImputationCenter: "None",
          // };
          aDocumentItems.push(oDocumentItem);
        });

        //Get items in local model
        this._oDetailModel.setProperty("/documentItems", aDocumentItems);

        //Get credit in local model
        this._oDetailModel.setProperty("/documentCredits", oVIMDocument.to_AvoirId);

        //Save item data from OData
        this._aOrigItems = deepClone(oVIMDocument.to_DocumentItem);

        //Calculate sold
        this._calculateSold();

        //In case of save, check updates with new data
        this._checkUpdates();
      },

      _onMetadataLoaded: function () {
        // Binding the view will set it to not busy - so the view is always busy if it is not bound
        this._oDetailModel.setProperty("/busy", true);
      },

      /**
       * Value Help search
       * @param {object} oParameters - Function parameters
       * @param {string} oParameters.fragmentId - Fragment ID
       * @param {array} oParameters.filters - Filters
       * @param {boolean} oParameters.search - Active search in value Help
       * @param {array} oParameters.sorters - Sorters
       * @param {array} oParameters.columns - Columns for value help table
       * @param {string} oParameters.bindingPath - Binding path for value help table
       * @function
       * @private
       */
      _loadVH: function (oParameters) {
        var sSearchValue = this._oDetailModel.getProperty(this._sDocumentItemPath + "/ImputationCenter"),
          oBasicSearchField = new SearchField({
            value: sSearchValue,
            search: () => {
              this._oVHDialogs[oParameters.fragmentId].getFilterBar().fireSearch();
            },
          });
        Fragment.load({
          name: "fr.applium.afl.aflapproval.view.fragment." + oParameters.fragmentId,
          id: this.getView().getId(),
          controller: this,
        }).then((oDialog) => {
          var oEvents = {
            dataRequested: () => {
              this.getModel("appView").setProperty("/busyVH", true);
            },

            dataReceived: () => {
              this._oVHDialogs[oParameters.fragmentId].update();
              this.getModel("appView").setProperty("/busyVH", false);
            },

            change: () => {
              this._oVHDialogs[oParameters.fragmentId].update();
            },
          };

          this._oVHDialogs[oParameters.fragmentId] = oDialog;
          this.getView().addDependent(this._oVHDialogs[oParameters.fragmentId]);

          if (oParameters.search) {
            this._oVHDialogs[oParameters.fragmentId].getFilterBar().setBasicSearch(oBasicSearchField);
          }

          this._oVHDialogs[oParameters.fragmentId].getTableAsync().then((oTable) => {
            oTable.setModel(this.getODataModel());
            oTable.setModel(
              new JSONModel({
                cols: oParameters.columns,
              }),
              "columns"
            );

            if (oTable.bindRows) {
              oTable.bindAggregation("rows", {
                path: oParameters.bindingPath,
                filters: oParameters.filters,
                sorter: oParameters.sorters,
                parameters: oParameters.parameters,
                events: oEvents,
              });
            }

            if (oTable.bindItems) {
              //Fix to set width in mobile
              oTable.getAggregation("columns").forEach((oColumn, iIndex) => {
                if (oParameters.columns[iIndex] && oParameters.columns[iIndex].width) {
                  oColumn.setWidth(oParameters.columns[iIndex].width);
                }

                if (oParameters.columns[iIndex] && oParameters.columns[iIndex].minScreenWidth) {
                  oColumn.setMinScreenWidth(oParameters.columns[iIndex].minScreenWidth);
                }

                if (oParameters.columns[iIndex] && oParameters.columns[iIndex].demandPopin) {
                  oColumn.setDemandPopin(oParameters.columns[iIndex].demandPopin);
                }
              });
              oTable.bindAggregation("items", {
                path: oParameters.bindingPath,
                filters: oParameters.filters,
                sorter: oParameters.sorters,
                events: oEvents,
                factory: () => {
                  var aCells = [];
                  oParameters.columns.forEach((oCol) => {
                    aCells.push(
                      new Label({
                        text: "{" + oCol.template + "}",
                      })
                    );
                  });
                  return new ColumnListItem({
                    cells: aCells,
                  });
                },
              });
            }

            if (sSearchValue) {
              this._searchVH({
                fragmentId: oParameters.fragmentId,
                search: sSearchValue,
              });
            }

            this._oVHDialogs[oParameters.fragmentId].open();
          });
        });
      },

      /**
       * Value Help search
       * @param {object} oParameters - Function parameters
       * @param {string} oParameters.fragmentId - Fragment ID
       * @param {string} oParameters.search - Search string
       * @param {array} oParameters.filters - Filters to apply
       * @function
       * @private
       */
      _searchVH: function (oParameters) {
        var oFilter;

        //Search management
        this._oVHDialogs[oParameters.fragmentId].getTableAsync().then((oTable) => {
          var oBindingInfo, sAggregation;
          if (oTable.bindRows) {
            sAggregation = "rows";
          }

          if (oTable.bindItems) {
            sAggregation = "items";
          }

          if (oParameters.search !== undefined) {
            oBindingInfo = oTable.getBindingInfo(sAggregation);

            if (!oBindingInfo.parameters) {
              oBindingInfo.parameters = {};
            }

            if (!oBindingInfo.parameters.custom) {
              oBindingInfo.parameters.custom = {};
            }

            oBindingInfo.parameters.custom.search = oParameters.search;

            oTable.bindAggregation(sAggregation, oBindingInfo);
          }

          //Filter management
          else if (oParameters.filters) {
            oFilter = new Filter({
              filters: oParameters.filters,
              and: true,
            });

            oTable.getBinding(sAggregation).filter(oFilter);
          }

          this._oVHDialogs[oParameters.fragmentId].update();
        });
      },

      _calculateSold: function () {
        var aItems = this._oDetailModel.getProperty("/documentItems"),
          sNetAmount = this.getView().getBindingContext().getObject().NetAmount,
          bSaveEnabled = true,
          fSold = parseFloat(sNetAmount);

        aItems.forEach((oItem) => {
          if (oItem.AmountInDocCurrency) {
            fSold = fSold - parseFloat(oItem.AmountInDocCurrency);
          }
          if (oItem.AmountInDocCurrency < 0 || oItem.AmountInDocCurrency === "") {
            bSaveEnabled = false;
          }
        });
        if (fSold.toFixed(2) === "-0.00") {
          fSold = 0;
        }
        this._oDetailModel.setProperty("/soldAmount", fSold.toFixed(2));
        if (fSold.toFixed(2) === "0.00" && bSaveEnabled === true) {
          this._oDetailModel.setProperty("/saveEnabled", true);
        } else {
          this._oDetailModel.setProperty("/saveEnabled", false);
        }
      },

      _checkUpdates: function () {
        var aItems = this._oDetailModel.getProperty("/documentItems");

        this._oDetailModel.setProperty("/changes", !deepEqual(aItems, this._aOrigItems));
      },

      _loadUsersRolesVH: function (sRole) {
        var aSorters = [new Sorter("UserId")],
          aFilters = [],
          aCols = [
            {
              label: "{/#VHUsersRoles/UserId/@sap:label}",
              template: "detailView>UserId",
              width: "auto",
            },
            {
              label: "{/#VHUsersRoles/LastName/@sap:label}",
              template: "detailView>LastName",
              width: "auto",
            },
            {
              label: "{/#VHUsersRoles/FirstName/@sap:label}",
              template: "detailView>FirstName",
              width: "auto",
            },
          ],
          sBindingPath = sRole === "Accountants" ? "detailView>/accountants" : "detailView>/validators";

        this._loadVH({
          fragmentId: "VHUsersRoles",
          bindingPath: sBindingPath,
          filters: aFilters,
          sorters: aSorters,
          columns: aCols,
          search: true,
        });
      },

      _onCommentDisplay: function () {
        if (!this._oCommentDialog) {
          Fragment.load({
            name: "fr.applium.afl.aflapproval.view.fragment.CommentDialog",
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

      _onCommentNeutralDisplay: function () {
        if (!this._oCommentDialogNeutral) {
          Fragment.load({
            name: "fr.applium.afl.aflapproval.view.fragment.CommentDialogNeutral",
            id: this.getView().getId(),
            controller: this,
          }).then((oDialog) => {
            this._oCommentDialogNeutral = oDialog;
            this.getView().addDependent(this._oCommentDialogNeutral);
            this._oCommentDialogNeutral.open();
          });
        } else {
          this._oCommentDialogNeutral.open();
        }
      },

      _transferDocumentUserVH: function () {
        var oAppModel = this.getModel("appView");

        oAppModel.setProperty("/busy", true);
        //Get actors from backend
        this.getODataModel().callFunction("/GetValidators", {
          method: "GET",
          urlParameters: {
            DocumentId: this.getView().getBindingContext().getObject().DocumentId,
          },
          success: (oGetValidatorsSuccess) => {
            this._oDetailModel.setProperty("/validators", oGetValidatorsSuccess.results);
            this._loadUsersRolesVH("Validators");
            oAppModel.setProperty("/busy", false);
          },
          error: (oGetValidatorsError) => {
            oAppModel.setProperty("/busy", false);
            this.handleErrorMessage(this.determineODataErrorText(oGetValidatorsError));
          },
        });
      },

      _referDocumentUserVH: function () {
        var oAppModel = this.getModel("appView");

        oAppModel.setProperty("/busy", true);

        this.getODataModel().callFunction("/Response", {
          method: "GET",
          urlParameters: {
            DocumentId: this.getView().getBindingContext().getObject().DocumentId,
          },
          success: (oGetResponseSuccess) => {
            this._oDetailModel.setProperty("/Response", oGetResponseSuccess.results);
            // this._loadUsersRolesVH("Accountants");
            oAppModel.setProperty("/busy", false);
            this.handleSuccessMessage(oGetResponseSuccess.results[0].Message);
          },
          error: (oGetResponseError) => {
            oAppModel.setProperty("/busy", false);
            this.handleErrorMessage(this.determineODataErrorText(oGetResponseError));
          },
        });
      },

      _referTo: function (aUsers) {
        var oAppModel = this.getModel("appView"),
          oReferTo = {
            DocumentId: this.getView().getBindingContext().getObject().DocumentId,
            // ToActor: this._sCurrentAction === "Refer" ? "COMPTABLE" : "VALIDEUR_FACTUR",
            LogComment: oAppModel.getProperty("/comment/value"),
            UserId: aUsers[0].UserId,
          };

        oAppModel.setProperty("/busy", true);

        this.getODataModel().callFunction("/Refer", {
          method: "GET",
          urlParameters: oReferTo,
          success: (oReferToSuccess) => {
            //Navigate to next document and refresh master list
            // this._navigateToNextDocument();
            this.getODataModel().refresh(true);
            this.getRouter().navTo("master");
            oAppModel.setProperty("/busy", false);
            this.handleSuccessMessage(oReferToSuccess.results[0].Message);
          },

          error: (oReferToError) => {
            this.handleErrorMessage(this.determineODataErrorText(oReferToError));
            oAppModel.setProperty("/busy", false);
          },
        });
      },

      _validateDocument: function () {
        var sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
          sComment = this.getModel("appView").getProperty("/comment/value"),
          oAppModel = this.getModel("appView");

        oAppModel.setProperty("/busy", true);

        this.getODataModel().callFunction("/Validate", {
          method: "POST",
          groupId: "Validate-" + sDocumentId,
          urlParameters: {
            DocumentId: sDocumentId,
            LogComment: sComment,
          },
          success: (oValidateSuccess) => {
            //Navigate to next document and refresh master list
            this._navigateToNextDocument();
            oAppModel.setProperty("/busy", false);
          },
          error: (oValidateError) => {
            this.handleErrorMessage(this.determineODataErrorText(oValidateError));
            oAppModel.setProperty("/busy", false);
          },
        });
      },

      _rejectDocument: function () {
        var sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
          sComment = this.getModel("appView").getProperty("/comment/value"),
          oAppModel = this.getModel("appView");

        oAppModel.setProperty("/busy", true);

        this.getODataModel().callFunction("/Reject", {
          method: "POST",
          groupId: "Reject-" + sDocumentId,
          urlParameters: {
            DocumentId: sDocumentId,
            LogComment: sComment,
          },
          success: (oRejectSuccess) => {
            //Navigate to next document and refresh master list
            this._navigateToNextDocument();
            oAppModel.setProperty("/busy", false);
          },
          error: (oRejectError) => {
            this.handleErrorMessage(this.determineODataErrorText(oRejectError));
            oAppModel.setProperty("/busy", false);
          },
        });
      },

      _reinitComment: function () {
        this.getModel("appView").setProperty("/comment", {
          mandatory: false,
          value: "",
          submitEnabled: false,
        });
      },

      _navigateToNextDocument: function () {
        var oNextDocument,
          sCurrentPath = this.getView().getElementBinding().getPath(),
          oNextListItem = this.getOwnerComponent().oListSelector.findNextItem(sCurrentPath);

        if (oNextListItem) {
          oNextDocument = oNextListItem.getBindingContext().getObject();

          //Select next document
          this.getRouter().navTo("object", {
            objectId: oNextDocument.DocumentId,
          });
        } else {
          this.getRouter().navTo("master");
        }

        // //Refresh master list
        // this.getOwnerComponent().getEventBus().publish("Master", "RefreshList");
      },

      _validateInputs: function () {
        var aItems = this._oDetailModel.getProperty("/documentItems"),
          bRetValid = true;
        // aItems.forEach((oItem) => {
        // oItem.to_ValueStates.ImputationCenter = oItem.ImputationCenter ? "None" : "Error";
        // oItem.to_ValueStates.AmountInDocCurrency = oItem.AmountInDocCurrency !== "" ? "None" : "Error";
        // if (
        // oItem.to_ValueStates.ImputationCenter === "Error" ||
        // oItem.to_ValueStates.AmountInDocCurrency === "Error"
        // ) {
        // bRetValid = false;
        // }
        // });

        this._oDetailModel.setProperty("/documentItems", aItems);

        return bRetValid;
      },

      _massAction: function (sAction) {
        var sDocumentId = this.getView().getBindingContext().getObject().DocumentId,
          oMassAction = {
            LogComment: this.getModel("appView").getProperty("/comment/value"),
            to_Document: [],
          },
          oAppModel = this.getModel("appView");

        oAppModel.setProperty("/busy", true);

        oMassAction.to_Document.push({
          DocumentId: sDocumentId,
          to_Message: [],
        });

        this.getODataModel().create("/ActionMass" + sAction, oMassAction, {
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

            //After Refresh
            // this.getODataModel().attachEventOnce("requestCompleted", () => {

            // } else {
            // 	//Navigate to next document and refresh master list

            // }

            //Release app
            oAppModel.setProperty("/busy", false);
            // });

            this.getODataModel().refresh(true);

            this.getRouter().navTo("master");

            this.getOwnerComponent().getEventBus().publish("Master", "RefreshList");

            // this._navigateToNextDocument();

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
      },
    });
  }
);
