sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/Sorter",
    "sap/ui/model/FilterOperator",
    "sap/m/GroupHeaderListItem",
    "sap/ui/Device",
    "sap/ui/core/Fragment",
    "../model/formatter",
    "sap/m/PDFViewer",
  ],
  function (
    BaseController,
    JSONModel,
    Filter,
    Sorter,
    FilterOperator,
    GroupHeaderListItem,
    Device,
    Fragment,
    formatter,
    PDFViewer
  ) {
    "use strict";

    return BaseController.extend("fr.applium.afl.aflapprovaldisc.controller.List", {
      formatter: formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      /**
       * Called when the list controller is instantiated. It sets up the event handling for the list/detail communication and other lifecycle tasks.
       * @public
       */
      onInit: function () {
        // Control state model
        var oViewModel = this._createViewModel(),
          oList = this.byId("masterSmartTable"),
          // Put down list's original value for busy indicator delay,
          // so it can be restored later on. Busy handling on the list is
          // taken care of by the list itself.
          iOriginalBusyDelay = oList.getBusyIndicatorDelay();

        this._oMasterTable = this.byId("masterTable");
        this._oMasterSmartTable = this.byId("masterSmartTable");
        this.setModel(oViewModel, "listView");

        /*
         // Make sure, busy indication is showing immediately so there is no
          // break after the busy indication for loading the view's meta data is
          // ended (see promise 'oWhenMetadataIsLoaded' in AppController)
          oList.attachEventOnce("updateFinished", function(){
              // Restore original busy indicator delay for the list
              oViewModel.setProperty("/delay", iOriginalBusyDelay);
          });*/
        this.getView().addEventDelegate({
          onBeforeFirstShow: function () {
            this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
          }.bind(this),
        });

        this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
        this.getRouter().attachBypassed(this.onBypassed, this);

        //this.getOwnerComponent().getEventBus().subscribe("Master", "DeactivateColumns", this.onRefresh(), this);

        //this.getModel("appView")

        /*
          this._oGroupFunctions = {
              NetAmount: function(oContext) {
                  var iNumber = oContext.getProperty('NetAmount'),
                      key, text;
                  if (iNumber <= 20) {
                      key = "LE20";
                      text = this.getResourceBundle().getText("listGroup1Header1");
                  } else {
                      key = "GT20";
                      text = this.getResourceBundle().getText("listGroup1Header2");
                  }
                  return {
                      key: key,
                      text: text
                  };
              }.bind(this)
          };
          
          this._oList = oList;
          // keeps the filter and search state
          this._oListFilterState = {
              aFilter : [],
              aSearch : []
          };
      
          this.setModel(oViewModel, "listView");
          
          // Make sure, busy indication is showing immediately so there is no
          // break after the busy indication for loading the view's meta data is
          // ended (see promise 'oWhenMetadataIsLoaded' in AppController)
          oList.attachEventOnce("updateFinished", function(){
              // Restore original busy indicator delay for the list
              oViewModel.setProperty("/delay", iOriginalBusyDelay);
          });

          this.getView().addEventDelegate({
              onBeforeFirstShow: function () {
                  this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
              }.bind(this)
          });
     
          this.getRouter().getRoute("list").attachPatternMatched(this._onMasterMatched, this);
          this.getRouter().attachBypassed(this.onBypassed, this);
          */
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      /**
       * After list data is available, this handler method updates the
       * list counter
       * @param {sap.ui.base.Event} oEvent the update finished event
       * @public
       */
      onUpdateFinished: function (oEvent) {
        // update the list object counter after new data is loaded
        this._updateListItemCount(oEvent.getParameter("total"));
      },

      /**
       * Event handler for the list search field. Applies current
       * filter value and triggers a new search. If the search field's
       * 'refresh' button has been pressed, no new search is triggered
       * and the list binding is refresh instead.
       * @param {sap.ui.base.Event} oEvent the search event
       * @public
       */
      onSearch: function (oEvent) {
        if (oEvent.getParameters().refreshButtonPressed) {
          // Search field's 'refresh' button has been pressed.
          // This is visible if you select any list item.
          // In this case no new search is triggered, we only
          // refresh the list binding.
          this.onRefresh();
          return;
        }

        var sQuery = oEvent.getParameter("query");

        if (sQuery) {
          this._oListFilterState.aSearch = [new Filter("DocumentDate", FilterOperator.Contains, sQuery)];
        } else {
          this._oListFilterState.aSearch = [];
        }
        this._applyFilterSearch();
      },

      /**
       * Event handler for refresh event. Keeps filter, sort
       * and group settings and refreshes the list binding.
       * @public
       */
      onRefresh: function () {
        this._oList.getBinding("items").refresh();
      },

      /**
       * Event handler for the filter, sort and group buttons to open the ViewSettingsDialog.
       * @param {sap.ui.base.Event} oEvent the button press event
       * @public
       */
      onOpenViewSettings: function (oEvent) {
        var sDialogTab = "filter";
        if (oEvent.getSource() instanceof sap.m.Button) {
          var sButtonId = oEvent.getSource().getId();
          if (sButtonId.match("sort")) {
            sDialogTab = "sort";
          } else if (sButtonId.match("group")) {
            sDialogTab = "group";
          }
        }
        // load asynchronous XML fragment
        if (!this.byId("viewSettingsDialog")) {
          Fragment.load({
            id: this.getView().getId(),
            name: "fr.applium.afl.aflapprovaldisc.view.ViewSettingsDialog",
            controller: this,
          }).then(
            function (oDialog) {
              // connect dialog to the root view of this component (models, lifecycle)
              this.getView().addDependent(oDialog);
              oDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
              oDialog.open(sDialogTab);
            }.bind(this)
          );
        } else {
          this.byId("viewSettingsDialog").open(sDialogTab);
        }
      },

      /**
       * Event handler called when ViewSettingsDialog has been confirmed, i.e.
       * has been closed with 'OK'. In the case, the currently chosen filters, sorters or groupers
       * are applied to the list, which can also mean that they
       * are removed from the list, in case they are
       * removed in the ViewSettingsDialog.
       * @param {sap.ui.base.Event} oEvent the confirm event
       * @public
       */
      onConfirmViewSettingsDialog: function (oEvent) {
        var aFilterItems = oEvent.getParameters().filterItems,
          aFilters = [],
          aCaptions = [];

        // update filter state:
        // combine the filter array and the filter string
        aFilterItems.forEach(function (oItem) {
          switch (oItem.getKey()) {
            case "Filter1":
              aFilters.push(new Filter("NetAmount", FilterOperator.LE, 100));
              break;
            case "Filter2":
              aFilters.push(new Filter("NetAmount", FilterOperator.GT, 100));
              break;
            default:
              break;
          }
          aCaptions.push(oItem.getText());
        });

        this._oListFilterState.aFilter = aFilters;
        this._updateFilterBar(aCaptions.join(", "));
        this._applyFilterSearch();
        this._applySortGroup(oEvent);
      },

      /**
       * Event handler for the list selection event
       * @param {sap.ui.base.Event} oEvent the list selectionChange event
       * @public
       */
      onSelectionChange: function (oEvent) {
        var oList = oEvent.getSource(),
          bSelected = oEvent.getParameter("selected");

        // skip navigation when deselecting an item in multi selection mode
        if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
          // get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
          this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
        }
      },

      /**
       * Event handler for the bypassed event, which is fired when no routing pattern matched.
       * If there was an object selected in the list, that selection is removed.
       * @public
       */
      onBypassed: function () {
        this._oList.removeSelections(true);
      },

      /**
       * Used to create GroupHeaders with non-capitalized caption.
       * These headers are inserted into the list to
       * group the list's items.
       * @param {Object} oGroup group whose text is to be displayed
       * @public
       * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
       */
      createGroupHeader: function (oGroup) {
        return new GroupHeaderListItem({
          title: oGroup.text,
          upperCase: false,
        });
      },

      /**
       * Event handler for navigating back.
       * We navigate back in the browser history
       * @public
       */
      onNavBack: function () {
        // eslint-disable-next-line sap-no-history-manipulation
        history.go(-1);
      },
      onBeforeRebindTable: function (oEvent) {
        //Sort table
        var oBindingParameters = oEvent.getParameter("bindingParams"),
          aExpand = oBindingParameters.parameters["expand"] ? oBindingParameters.parameters["expand"].split(",") : [],
          aSelect = oBindingParameters.parameters["select"].split(",");
        // Always expand documentPDF to get PDF key to open it
        aExpand.push("to_DocumentPDF");
        oBindingParameters.parameters["expand"] = aExpand.join(",");
        // Always select documentPDF keys to open it after
        aSelect.push(
          "to_DocumentPDF/DocumentId",
          "to_DocumentPDF/BusinessObjectType",
          "to_DocumentPDF/ContentRepositoryId",
          "to_DocumentPDF/ArchiveDocumentId",
          "to_DocumentPDF/PdfIndex"
        );
        oBindingParameters.parameters["select"] = aSelect.join(",");
        if (!oBindingParameters.sorter.length) {
          oBindingParameters.sorter.push(new sap.ui.model.Sorter("DocumentId", true));
        }

        this.getOwnerComponent().oListSelector.setBoundMasterList(this._oMasterTable);
      },

      onPressPDF: function (oEvent) {
        //Only get PDF keys (impossible to get media type as it's a media field)
        var oVIMDocument = oEvent.getSource().getBindingContext().getObject({
            expand: "to_DocumentPDF",
            select:
              "to_DocumentPDF/DocumentId,to_DocumentPDF/BusinessObjectType,to_DocumentPDF/ContentRepositoryId,to_DocumentPDF/ArchiveDocumentId,to_DocumentPDF/PdfIndex",
          }),
          sPath = "",
          oDataModel = this.getODataModel();

        //Open PDF only if exists
        if (oVIMDocument.to_DocumentPDF) {
          sPath =
            oDataModel.sServiceUrl + "/" + oDataModel.createKey("DocumentPDF", oVIMDocument.to_DocumentPDF) + "/$value";

          if (!this._oPDFViewer) {
            this._oPDFViewer = new PDFViewer();
          }

          this._oPDFViewer.setSource(sPath);
          this._oPDFViewer.setTitle(oVIMDocument.DocumentId);
          this._oPDFViewer.open();
        }
      },
      /* =========================================================== */
      /* begin: internal methods                                     */
      /* =========================================================== */

      /**
       * Apply the chosen sorter and grouper to the list
       * @param {sap.ui.base.Event} oEvent the confirm event
       * @private
       */
      _applySortGroup: function (oEvent) {
        var mParams = oEvent.getParameters(),
          sPath,
          bDescending,
          aSorters = [];

        // apply sorter to binding
        // (grouping comes before sorting)
        if (mParams.groupItem) {
          sPath = mParams.groupItem.getKey();
          bDescending = mParams.groupDescending;
          var vGroup = this._oGroupFunctions[sPath];
          aSorters.push(new Sorter(sPath, bDescending, vGroup));
        }

        sPath = mParams.sortItem.getKey();
        bDescending = mParams.sortDescending;
        aSorters.push(new Sorter(sPath, bDescending));
        this._oList.getBinding("items").sort(aSorters);
      },

      /**
       * Sets the item count on the list header
       * @param {integer} iTotalItems the total number of items in the list
       * @private
       */
      _updateListItemCount: function (iTotalItems) {
        var sTitle;
        // only update the counter if the length is final
        if (this._oList.getBinding("items").isLengthFinal()) {
          sTitle = this.getResourceBundle().getText("List.listTitleCount", [iTotalItems]);
          this.getModel("listView").setProperty("/title", sTitle);
        }
      },

      _createViewModel: function () {
        return new JSONModel({
          isFilterBarVisible: false,
          filterBarLabel: "",
          delay: 0,
          title: this.getResourceBundle().getText("List.Table.Title", [0]),
          noDataText: this.getResourceBundle().getText("List.NoDataText"),
          sortBy: "DocumentDate",
          groupBy: "None",
        });
      },

      _onMasterMatched: function () {
        //this.getOwnerComponent().getEventBus().subscribe("Master", "DeactivateColumns", this.onRefresh(), this);
        //this.onRefresh();
        this.getModel("appView").attachPropertyChange(
          function (oEvent) {
            var param = oEvent.getParameter("value"),
              oFilterBar = this.byId("masterSmartFilter");

            if (param === "TwoColumnsBeginExpanded") {
              oFilterBar.setFilterBarExpanded(true);
            } else if (param === "TwoColumnsMidExpanded") {
              oFilterBar.setFilterBarExpanded(false);
            }
          }.bind(this)
        );

        //this.byId('masterSmartFilter').setFilterBarExpanded(true);

        //Set the layout property of the FCL control to 'OneColumn'
        this.getModel("appView").setProperty("/layout", "OneColumn");
      },

      /**
       * Shows the selected item on the detail page
       * On phones a additional history entry is created
       * @param {sap.m.ObjectListItem} oItem selected Item
       * @private
       */
      _showDetail: function (oItem) {
        var oFilterBar = this.byId("masterSmartFilter");

        oFilterBar.setFilterBarExpanded(false);
        var bReplace = !Device.system.phone;
        // set the layout property of FCL control to show two columns
        this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
        this.getRouter().navTo(
          "object",
          {
            objectId: oItem.getBindingContext().getProperty("DocumentId"),
          },
          bReplace
        );
      },

      /**
       * Sets the item count on the list header
       * @param {integer} iTotalItems the total number of items in the list
       * @private
       */
      _updateListItemCount: function (iTotalItems) {
        var sTitle;
        // only update the counter if the length is final
        if (this._oList.getBinding("items").isLengthFinal()) {
          sTitle = this.getResourceBundle().getText("List.listTitleCount", [iTotalItems]);
          this.getModel("listView").setProperty("/title", sTitle);
        }
      },

      /**
       * Internal helper method to apply both filter and search state together on the list binding
       * @private
       */
      _applyFilterSearch: function () {
        var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter),
          oViewModel = this.getModel("listView");
        this._oList.getBinding("items").filter(aFilters, "Application");
        // changes the noDataText of the list in case there are no filter results
        if (aFilters.length !== 0) {
          oViewModel.setProperty(
            "/noDataText",
            this.getResourceBundle().getText("List.listListNoDataWithFilterOrSearchText")
          );
        } else if (this._oListFilterState.aSearch.length > 0) {
          // only reset the no data text to default when no new search was triggered
          oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("List.listListNoDataText"));
        }
      },

      /**
       * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
       * @param {string} sFilterBarText the selected filter value
       * @private
       */
      _updateFilterBar: function (sFilterBarText) {
        var oViewModel = this.getModel("listView");
        oViewModel.setProperty("/isFilterBarVisible", this._oListFilterState.aFilter.length > 0);
        oViewModel.setProperty(
          "/filterBarLabel",
          this.getResourceBundle().getText("List.listFilterBarText", [sFilterBarText])
        );
      },
    });
  }
);

// sap.ui.define(
//   [
//     "./BaseController",
//     "sap/ui/model/json/JSONModel",
//     "sap/ui/core/Fragment",
//     "sap/ui/model/Sorter",
//     "sap/m/SearchField",
//     "sap/m/Label",
//     "sap/m/ColumnListItem",
//     "sap/ui/model/Filter",
//     "sap/m/PDFViewer",
//     "../model/formatter",
//   ],
//   function (
//     BaseController,
//     JSONModel,
//     Fragment,
//     Sorter,
//     SearchField,
//     Label,
//     ColumnListItem,
//     Filter,
//     PDFViewer,
//     formatter
//   ) {
//     "use strict";

//     return BaseController.extend("fr.applium.afl.aflapprovaldisc.controller.Master", {
//       formatter: formatter,
//       _oVHDialogs: {},

//       /* =========================================================== */
//       /* lifecycle methods                                           */
//       /* =========================================================== */

//       /**
//        * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
//        * @public
//        */
//       onInit: function () {
//         // Control state model
//         this._oMasterModel = new JSONModel({});
//         this.setModel(this._oMasterModel, "masterView");
//         this._initMasterModel();

//         this._oMasterTable = this.byId("masterTable");
//         this._oMasterSmartTable = this.byId("masterSmartTable");

//         this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
//         this.getRouter().attachBypassed(this.onBypassed, this);

//         this.getOwnerComponent().getEventBus().subscribe("Master", "DeactivateColumns", this._deactivateColumns, this);
//       },

//       onExit: function () {
//         var oFragment;

//         for (oFragment in this._oVHDialogs) {
//           if (oFragment && oFragment.destroy) {
//             oFragment.destroy();
//           }
//         }
//       },

//       /* =========================================================== */
//       /* event handlers                                              */
//       /* =========================================================== */

//       onBeforeRebindTable: function (oEvent) {
//         var oBindingParameters = oEvent.getParameter("bindingParams"),
//           aExpand = oBindingParameters.parameters["expand"].split(","),
//           aSelect = oBindingParameters.parameters["select"].split(",");
//         // Always expand documentPDF to get PDF key to open it
//         aExpand.push("to_DocumentPDF");
//         oBindingParameters.parameters["expand"] = aExpand.join(",");
//         // Always select documentPDF keys to open it after
//         aSelect.push(
//           "to_DocumentPDF/DocumentId",
//           "to_DocumentPDF/BusinessObjectType",
//           "to_DocumentPDF/ContentRepositoryId",
//           "to_DocumentPDF/ArchiveDocumentId",
//           "to_DocumentPDF/PdfIndex"
//         );
//         oBindingParameters.parameters["select"] = aSelect.join(",");
//         this.getOwnerComponent().oListSelector.setBoundMasterList(this._oMasterTable);
//       },

//       /**
//        * Event handler for the list selection event
//        * @param {sap.ui.base.Event} oEvent the list selectionChange event
//        * @public
//        */
//       onSelectionChange: function (oEvent) {
//         var oList = oEvent.getSource(),
//           bSelected = oEvent.getParameter("selected"),
//           aItems = oEvent.getParameter("listItems"),
//           oVIMDocument,
//           aSelectedItems = this._oMasterModel.getProperty("/selectedItems");

//         //Add to multiselect only in multiselect mode
//         if (oList.getMode() === "MultiSelect") {
//           aItems.forEach((oItem) => {
//             oVIMDocument = oItem.getBindingContext().getObject();
//             if (bSelected) {
//               aSelectedItems.push(oVIMDocument);
//               this._bindListItemToMasterViewDocument(oItem, oVIMDocument.DocumentId);
//             } else {
//               aSelectedItems = aSelectedItems.filter(
//                 (oSelectedVIMDocument) => oSelectedVIMDocument.DocumentId !== oVIMDocument.DocumentId
//               );
//             }
//           });

//           this._oMasterModel.setProperty("/selectedItems", aSelectedItems);
//         }

//         // skip navigation when deselecting an item in multi selection mode
//         //if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
//         // get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
//         //this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
//         //}
//       },

//       onItemPress: function (oEvent) {
//         var oItem = oEvent.getParameter("listItem");
//         this._showDetail(oItem);
//       },

//       /**
//        * Event handler for the bypassed event, which is fired when no routing pattern matched.
//        * If there was an object selected in the master list, that selection is removed.
//        * @public
//        */
//       onBypassed: function () {
//         this._oMasterTable.removeSelections(true);
//       },

//       /**
//        * Event handler for navigating back.
//        * We navigate back in the browser historz
//        * @public
//        */
//       onNavBack: function () {
//         // eslint-disable-next-line sap-no-history-manipulation
//         history.go(-1);
//       },

//       onPressPDF: function (oEvent) {
//         //Only get PDF keys (impossible to get media type as it's a media field)
//         var oVIMDocument = oEvent.getSource().getBindingContext().getObject({
//             expand: "to_DocumentPDF",
//             select:
//               "to_DocumentPDF/DocumentId,to_DocumentPDF/BusinessObjectType,to_DocumentPDF/ContentRepositoryId,to_DocumentPDF/ArchiveDocumentId,to_DocumentPDF/PdfIndex",
//           }),
//           sPath = "",
//           oDataModel = this.getODataModel();

//         //Open PDF only if exists
//         if (oVIMDocument.to_DocumentPDF) {
//           sPath =
//             oDataModel.sServiceUrl + "/" + oDataModel.createKey("DocumentPDF", oVIMDocument.to_DocumentPDF) + "/$value";

//           if (!this._oPDFViewer) {
//             this._oPDFViewer = new PDFViewer();
//           }

//           this._oPDFViewer.setSource(sPath);
//           this._oPDFViewer.setTitle(oVIMDocument.DocumentId);
//           this._oPDFViewer.open();
//         }
//       },

//       onPressValidate: function (oEvent) {
//         var oSource = oEvent.getSource(),
//           oBindingContext = oSource.getBindingContext(),
//           oVIMDocument = oBindingContext.getObject(),
//           oAppViewModel = this.getModel("appView");

//         //Bind cell to Master View model
//         this._bindListItemToMasterViewDocument(oSource.getParent(), oVIMDocument.DocumentId);

//         //Set current action
//         this._sCurrentAction = "Validate";
//         oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);
//         this._sCurrentDocumentId = oVIMDocument.DocumentId;

//         this._reinitComment();

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/ValidateCommentMandatory"));

//         this._onCommentDisplay();
//       },

//       onPressReject: function (oEvent) {
//         var oSource = oEvent.getSource(),
//           oBindingContext = oSource.getBindingContext(),
//           oVIMDocument = oBindingContext.getObject(),
//           oAppViewModel = this.getModel("appView");

//         //Bind cell to Master View model
//         this._bindListItemToMasterViewDocument(oSource.getParent(), oVIMDocument.DocumentId);

//         //Set current action
//         this._sCurrentAction = "Reject";
//         oAppViewModel.setProperty("/sActionSource", this._sCurrentAction);
//         this._sCurrentDocumentId = oVIMDocument.DocumentId;

//         this._reinitComment();

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/RejectCommentMandatory"));

//         this._onCommentDisplay();
//       },

//       onPressCancelComment: function () {
//         this._oCommentDialog.close();
//         this._reinitComment();
//       },

//       onPressSubmitComment: function () {
//         this._oCommentDialog.close();

//         switch (this._sCurrentAction) {
//           case "Validate":
//             this._massAction("Validate");
//             break;
//           // this._validateDocument(this._sCurrentDocumentId);
//           // break;
//           case "Reject":
//             this._massAction("Reject");
//             break;
//           // this._rejectDocument(this._sCurrentDocumentId);
//           // break;
//           case "ValidateSelected":
//             this._massAction("Validate");
//             break;

//           case "RejectSelected":
//             this._massAction("Reject");
//             break;

//           default:
//         }
//       },

//       onPressValidateSelected: function () {
//         var oAppViewModel = this.getModel("appView");

//         //Set current action
//         this._sCurrentAction = "ValidateSelected";
//         oAppViewModel.setProperty("/sActionSource", "Validate");
//         this._reinitComment();

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/ValidateCommentMandatory"));

//         this._onCommentDisplay();
//       },

//       onPressRejectSelected: function () {
//         var oAppViewModel = this.getModel("appView");

//         //Set current action
//         this._sCurrentAction = "RejectSelected";
//         oAppViewModel.setProperty("/sActionSource", "Reject");
//         this._reinitComment();

//         //determine if comment is mandatory
//         oAppViewModel.setProperty("/comment/mandatory", oAppViewModel.getProperty("/custo/RejectCommentMandatory"));

//         this._onCommentDisplay();
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
//           ],
//           oBC = oEvent.getSource().getBindingContext();

//         this._sDocumentPath = oBC.getPath();

//         //Bind cell to Master View model
//         this._bindListItemToMasterViewDocument(oEvent.getSource().getParent(), oBC.getObject().DocumentId);

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

//         this.getODataModel().setProperty(this._sDocumentPath + "/ImputationCenter", sImputationCenter);

//         this._checkUpdates(this.getODataModel().getProperty(this._sDocumentPath + "/DocumentId"));
//       },

//       onSearchVHImputationCenter: function (oEvent) {
//         var sSearchQuery = oEvent.getSource().getBasicSearchValue();

//         this._searchVH({
//           fragmentId: "VHImputationCenter",
//           search: sSearchQuery,
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

//           this.getODataModel().setProperty(this._sDocumentPath + "/ImputationCenter", oItemSelected.ImputationCenter);
//           this._checkUpdates(this.getODataModel().getProperty(this._sDocumentPath + "/DocumentId"));

//           this._oVHDialogs["VHImputationCenter"].close();
//         });
//       },

//       onCancelVHImputationCenter: function () {
//         this._oVHDialogs["VHImputationCenter"].close();
//       },

//       onAfterCloseVHImputationCenter: function () {
//         this._oVHDialogs["VHImputationCenter"].destroy();
//       },

//       onLiveChangeImputationCenter: function (oEvent) {
//         var oSource = oEvent.getSource(),
//           oBC = oSource.getBindingContext(),
//           oItem = oBC.getObject();

//         this._sDocumentPath = oEvent.getSource().getBindingContext().getPath();

//         //Bind cell to Master View model
//         this._bindListItemToMasterViewDocument(oSource.getParent(), oItem.DocumentId);

//         this._checkUpdates(oItem.DocumentId);
//       },

//       onPressSave: function (oEvent) {
//         var oAppModel = this.getModel("appView"),
//           oSource = oEvent.getSource(),
//           oVIMDocument = oSource.getBindingContext().getObject(),
//           oVIMDocumentToSave = {
//             DocumentId: oVIMDocument.DocumentId,
//             to_DocumentItem: [
//               {
//                 DocumentId: oVIMDocument.DocumentId,
//                 AmountInDocCurrency: oVIMDocument.NetAmount,
//                 ImputationCenter: oVIMDocument.ImputationCenter,
//               },
//             ],
//           };

//         if (oVIMDocument.ImputationCenter) {
//           oAppModel.setProperty("/busy", true);

//           this.getODataModel().create("/Document", oVIMDocumentToSave, {
//             success: (oSaveSuccess) => {
//               this.getODataModel().attachEventOnce("requestCompleted", () => {
//                 var oProcessItems = this._oMasterModel.getProperty("/processItems");
//                 oProcessItems[oVIMDocument.DocumentId].Changed = false;
//                 this._oMasterModel.setProperty("/processItems", oProcessItems);
//                 oAppModel.setProperty("/busy", false);
//               });
//               //oSource.getModel().refresh(true);
//               this.getODataModel().read("/Document('" + oVIMDocument.DocumentId + "')", {
//                 urlParameters: {
//                   //"$expand" : "to_DocumentType,to_DocumentPDF"
//                   // $expand: "to_DocumentPDF",
//                 },
//                 error: (oReadError) => {
//                   this.handleErrorMessage(this.determineODataErrorText(oReadError));
//                 },
//               });
//             },

//             error: (oSaveError) => {
//               this.handleErrorMessage(this.determineODataErrorText(oSaveError));
//               oAppModel.setProperty("/busy", false);
//             },
//             refreshAfterChange: false,
//           });
//         }
//       },

//       onCloseProcessStatus: function (oEvent) {
//         var sPath = oEvent.getSource().getBindingContext("masterView").getPath();
//         this._oMasterModel.setProperty(sPath + "/ProcessStatus", "");
//         oEvent.preventDefault();
//       },

//       /* =========================================================== */
//       /* begin: internal methods                                     */
//       /* =========================================================== */

//       _initMasterModel: function () {
//         this._oMasterModel.setProperty("/", {
//           processItems: {},
//           selectedItems: [],
//         });
//       },

//       _onMasterMatched: function () {
//         //Set the layout property of the FCL control to 'OneColumn'
//         this.getModel("appView").setProperty("/layout", "OneColumn");

//         //Activate Actions column
//         this._oMasterSmartTable.deactivateColumns([]);
//       },

//       /**
//        * Shows the selected item on the detail page
//        * On phones a additional history entry is created
//        * @param {sap.m.ObjectListItem} oItem selected Item
//        * @private
//        */
//       _showDetail: function (oItem) {
//         //var bReplace = !Device.system.phone;
//         // set the layout property of FCL control to show two columns
//         var sCurrentLayout = this.getModel("appView").getProperty("/layout");

//         //Reset changes (if Imputations center were updated)
//         this.getODataModel().resetChanges();
//         this._initMasterModel();

//         if (sCurrentLayout.startsWith("ThreeColumns")) {
//           this.getRouter().navTo("pdf", {
//             objectId: oItem.getBindingContext().getProperty("DocumentId"),
//           });
//         } else {
//           this.getRouter().navTo("object", {
//             objectId: oItem.getBindingContext().getProperty("DocumentId"),
//           });
//         }
//       },

//       _setProcessStatus: function (sDocumentId, sStatus) {
//         var oProcessItems = this._oMasterModel.getProperty("/processItems");

//         oProcessItems[sDocumentId].ProcessStatus = sStatus;

//         this._oMasterModel.setProperty("/processItems", oProcessItems);
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
//             // this._oCommentDialog.setModel(new JSONModel({
//             // 	sActionSource : sCurrentAction
//             // }),'CommentDialogModel');
//             this._oCommentDialog.open();
//           });
//         } else {
//           this._oCommentDialog.open();
//         }
//       },

//       _validateDocument: function (sDocumentId) {
//         var sComment = this.getModel("appView").getProperty("/comment/value");

//         this._setProcessStatus(sDocumentId, "InValidation");

//         this.getODataModel().callFunction("/Validate", {
//           method: "POST",
//           groupId: "Validate-" + sDocumentId,
//           urlParameters: {
//             DocumentId: sDocumentId,
//             LogComment: sComment,
//           },
//           success: function (oValidateSuccess) {
//             this._setProcessStatus(sDocumentId, "Validated");
//             this._oMasterTable.getBinding("items").refresh(true);
//             this._oMasterSmartTable.rebindTable();
//           }.bind(this),
//           error: function (oValidateError) {
//             this._setProcessStatus(sDocumentId, "Error");
//             this.handleErrorMessage(this.determineODataErrorText(oValidateError));
//           }.bind(this),
//         });
//       },

//       _rejectDocument: function (sDocumentId) {
//         var sComment = this.getModel("appView").getProperty("/comment/value");

//         this._setProcessStatus(sDocumentId, "InRejection");

//         this.getODataModel().callFunction("/Reject", {
//           method: "POST",
//           groupId: "Reject-" + sDocumentId,
//           urlParameters: {
//             DocumentId: sDocumentId,
//             LogComment: sComment,
//           },
//           success: function (oRejectSuccess) {
//             this._setProcessStatus(sDocumentId, "Rejected");
//             this._oMasterTable.getBinding("items").refresh(true);
//           }.bind(this),
//           error: function (oRejectError) {
//             this._setProcessStatus(sDocumentId, "Error");
//             this.handleErrorMessage(this.determineODataErrorText(oRejectError));
//           }.bind(this),
//         });
//       },

//       _bindListItemToMasterViewDocument: function (oItem, sDocumentId) {
//         var oProcessItems = this._oMasterModel.getProperty("/processItems");

//         if (!oProcessItems[sDocumentId]) {
//           oProcessItems[sDocumentId] = {
//             ProcessStatus: "",
//             Changed: false,
//           };
//         }

//         oItem.bindElement({
//           model: "masterView",
//           path: "/processItems/" + sDocumentId,
//         });
//       },

// _deactivateColumns: function (sChannelId, sEventId) {
//   this._oMasterSmartTable.deactivateColumns(["ActionButtons", "ImputationCenter"]);
// },

//       _refreshList: function (sChannelId, sEventId) {
//         this._oMasterTable.getBinding("items").refresh(true);
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
//         var sSearchValue = this.getODataModel().getProperty(this._sDocumentPath + "/ImputationCenter"),
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

//       _checkUpdates: function (sDocumentId) {
//         var oDataModel = this.getODataModel(),
//           oPendingChanges = oDataModel.getPendingChanges(),
//           oProcessItems = this._oMasterModel.getProperty("/processItems"),
//           sKey = oDataModel.createKey("Document", {
//             DocumentId: sDocumentId,
//           });

//         if (oPendingChanges[sKey] && oPendingChanges[sKey].ImputationCenter) {
//           oProcessItems[sDocumentId].Changed = true;
//         } else {
//           oProcessItems[sDocumentId].Changed = false;
//         }

//         this._oMasterModel.setProperty("/processItems", oProcessItems);
//       },

//       _reinitComment: function () {
//         this.getModel("appView").setProperty("/comment", {
//           mandatory: false,
//           value: "",
//           submitEnabled: false,
//         });
//       },

//       _massAction: function (sAction) {
//         var aSelectedItems = this._oMasterModel.getProperty("/selectedItems"),
//           oMassAction = {
//             LogComment: this.getModel("appView").getProperty("/comment/value"),
//             to_Document: [],
//           },
//           oAppModel = this.getModel("appView"),
//           oProcessItem = this._oMasterModel.getData().processItems,
//           sDocumentId = Object.keys(oProcessItem)[0];

//         oAppModel.setProperty("/busy", true);

//         if (aSelectedItems.length > 0) {
//           aSelectedItems.forEach((oSelectedVIMDocument) =>
//             //this._validateDocument(oSelectedVIMDocument.DocumentId)
//             oMassAction.to_Document.push({
//               DocumentId: oSelectedVIMDocument.DocumentId,
//               to_Message: [],
//             })
//           );
//         } else {
//           oMassAction.to_Document.push({
//             DocumentId: sDocumentId,
//             to_Message: [],
//           });
//         }

//         this.getODataModel().create("/ActionMass" + sAction, oMassAction, {
//           success: (oValidateSuccess) => {
//             let sMessage = "";
//             let bError = false;

//             //Deselect all documents and reset process
//             this._initMasterModel();
//             this._oMasterTable.removeSelections(true);
//             this.getODataModel().resetChanges();

//             oValidateSuccess.to_Document.results.forEach((oDocumentReturn) => {
//               if (oDocumentReturn.to_Message && oDocumentReturn.to_Message.results) {
//                 oDocumentReturn.to_Message.results.forEach((oMessage) => {
//                   if (sMessage) {
//                     sMessage += "\n";
//                   }
//                   sMessage += oMessage.ReturnMessage;
//                 });
//               }
//             });

//             //After Refresh
//             this.getODataModel().attachEventOnce("requestCompleted", () => {
//               //In case of error, display them

//               this.handleInfoMessage(sMessage);

//               //Release app
//               oAppModel.setProperty("/busy", false);
//             });

//             this.getODataModel().refresh(true);
//             this._oMasterTable.rebindTable();
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
