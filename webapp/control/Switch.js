sap.ui.define(["sap/m/Switch"], function (Switch) {
  "use strict";
  return Switch.extend("fr.applium.vim.ZAPPROVPOGAP.control.Switch", {
    metadata: {
      events: {
        switchover: {
          parameters: {
            switchid: {
              type: "String",
            },
          },
        },
        switchleave: {
          parameters: {
            switchid: {
              type: "String",
            },
          },
        },
      },
      properties: {
        switchid: {
          type: "string",
          defaultValue: "",
        },
      },
    },
    renderer: {},
    onAfterRendering: function () {
      if (Switch.prototype.onAfterRendering) {
        Switch.prototype.onAfterRendering.apply(this, arguments);
      }

      this.$().mouseenter(
        function () {
          this.fireSwitchover({
            switchid: this.getSwitchid(),
          });
        }.bind(this)
      );

      this.$().mouseleave(
        function () {
          this.fireSwitchleave({
            switchid: this.getSwitchid(),
          });
        }.bind(this)
      );
    },

    setSwitchid: function (sValue) {
      this.setProperty("switchid", sValue, true);
      return this;
    },

    getSwitchid: function () {
      return this.getProperty("switchid");
    },
  });
});
