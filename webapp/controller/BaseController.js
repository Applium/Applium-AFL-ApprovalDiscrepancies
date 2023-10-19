sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/core/routing/History", "sap/m/MessageBox"],
  function (Controller, History, MessageBox) {
    "use strict";

    return Controller.extend("fr.applium.afl.aflapproval.controller.BaseController", {
      /**
       * Convenience method for accessing the router in every controller of the application.
       * @public
       * @returns {sap.ui.core.routing.Router} the router for this component
       */
      getRouter: function () {
        return this.getOwnerComponent().getRouter();
      },

      /**
       * Convenience method for getting the view model by name in every controller of the application.
       * @public
       * @param {string} sName the model name
       * @returns {sap.ui.model.Model} the model instance
       */
      getModel: function (sName) {
        return this.getView().getModel(sName);
      },

      /**
       * Convenience method for getting the odata model by name in every controller of the application.
       * @public
       * @param {string} sName the model name
       * @returns {sap.ui.model.Model} the model instance
       */
      getODataModel: function (sName) {
        return this.getOwnerComponent().getModel(sName);
      },

      /**
       * Convenience method for setting the view model in every controller of the application.
       * @public
       * @param {sap.ui.model.Model} oModel the model instance
       * @param {string} sName the model name
       * @returns {sap.ui.mvc.View} the view instance
       */
      setModel: function (oModel, sName) {
        return this.getView().setModel(oModel, sName);
      },

      /**
       * Convenience method for getting the resource bundle.
       * @public
       * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
       */
      getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },

      /**
       * Event handler for navigating back.
       * It there is a history entry we go one step back in the browser history
       * If not, it will replace the current entry of the browser history with the master route.
       * @public
       */
      onNavBack: function () {
        var sPreviousHash = History.getInstance().getPreviousHash();

        if (sPreviousHash !== undefined) {
          // eslint-disable-next-line sap-no-history-manipulation
          history.go(-1);
        } else {
          this.getRouter().navTo("master", {}, true);
        }
      },

      /**
       * Error when webservice called. Determine error text
       * @function
       * @param {object} oError Error object returned by webservice call
       * @return {string} sText The error text
       * @public
       */
      determineODataErrorText: function (oError) {
        var oResponse, sText;
        try {
          oResponse = JSON.parse(oError.responseText);
          sText = oResponse.error.message.value;
        } catch (oException1) {
          try {
            oResponse = this._xmlToJson($.parseXML(oError.responseText));
            sText = oResponse.error ? oResponse.error.message["#text"] : oResponse.html.body.h1["#text"];
          } catch (oException2) {
            sText = oError.responseText;
          }
        }
        return sText;
      },

      /**
       * Transform XML to JSON
       * @function
       * @param {object} oXML XML object
       * @return {object} js object
       * @public
       */
      _xmlToJson: function (oXML) {
        // Create the return object
        var oReturn = {};

        if (oXML.nodeType === 1) {
          // element
          // do attributes
          if (oXML.attributes.length > 0) {
            oReturn["@attributes"] = {};
            for (var j = 0; j < oXML.attributes.length; j++) {
              var attribute = oXML.attributes.item(j);
              oReturn["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
          }
        } else if (oXML.nodeType === 3) {
          // text
          oReturn = oXML.nodeValue;
        }

        // do children
        if (oXML.hasChildNodes()) {
          for (var i = 0; i < oXML.childNodes.length; i++) {
            var item = oXML.childNodes.item(i);
            var nodeName = item.nodeName;
            if (typeof oReturn[nodeName] === "undefined") {
              oReturn[nodeName] = this._xmlToJson(item);
            } else {
              if (typeof oReturn[nodeName].push === "undefined") {
                var old = oReturn[nodeName];
                oReturn[nodeName] = [];
                oReturn[nodeName].push(old);
              }
              oReturn[nodeName].push(this._xmlToJson(item));
            }
          }
        }
        return oReturn;
      },

      /**
       * Handle error message and focus on an input
       * @param {string} sMessage, Message to display in popup
       * @param {function} fnCallback, Callback function
       * @function
       * @private
       */
      handleErrorMessage: function (sMessage, fnCallback) {
        //Display Error in popup
        MessageBox.error(sMessage, {
          onClose: function () {
            if (fnCallback) {
              fnCallback();
            }
          }.bind(this),
        });
      },

      /**
       * Handle info message and focus on an input
       * @param {string} sMessage, Message to display in popup
       * @param {function} fnCallback, Callback function
       * @function
       * @private
       */
      handleInfoMessage: function (sMessage, fnCallback) {
        //Display Error in popup
        MessageBox.information(sMessage, {
          onClose: function () {
            if (fnCallback) {
              fnCallback();
            }
          }.bind(this),
        });
      },

      /**
       * Handle success message and focus on an input
       * @param {string} sMessage, Message to display in popup
       * @param {function} fnCallback, Callback function
       * @function
       * @private
       */
      handleSuccessMessage: function (sMessage, fnCallback) {
        //Display Error in popup
        MessageBox.success(sMessage, {
          onClose: function () {
            if (fnCallback) {
              fnCallback();
            }
          }.bind(this),
        });
      },
    });
  }
);
