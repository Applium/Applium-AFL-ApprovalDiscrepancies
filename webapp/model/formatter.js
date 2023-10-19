sap.ui.define([], function () {
  "use strict";

  return {
    /**
     * Rounds the currency value to 2 digits
     *
     * @public
     * @param {string} sValue value to be formatted
     * @returns {string} formatted currency value with 2 digits
     */
    currencyValue: function (sValue) {
      if (!sValue) {
        return "";
      }

      return parseFloat(sValue).toFixed(2);
    },

    buttonVisible: function (sProcessStatus) {
      return !sProcessStatus || sProcessStatus === "Error";
    },

    processStatusText: function (sProcessStatus) {
      var sRet = "";
      if (sProcessStatus) {
        sRet = this.getResourceBundle().getText("Master.Table.ProcessStatus." + sProcessStatus);
      }
      return sRet;
    },

    processStatusType: function (sProcessStatus) {
      var sType;

      switch (sProcessStatus) {
        case "Validated":
        case "Rejected":
          sType = "Success";
          break;
        case "Error":
          sType = "Error";
          break;
        default:
          sType = "Information";
      }

      return sType;
    },

    processStatusColor: function (sProcessStatus) {
      var iColor;

      switch (sProcessStatus) {
        case "InValidation":
          iColor = 5;
          break;
        case "InRejection":
          iColor = 5;
          break;
        case "Validated":
          iColor = 8;
          break;
        case "Rejected":
          iColor = 2;
          break;
        case "Error":
          iColor = 3;
          break;
        default:
          iColor = 9;
      }

      return iColor;
    },

    pdfFullScreenBtnVisible: function (bMobile, sLayout) {
      var bRet = false;

      if (!bMobile) {
        bRet = sLayout.startsWith("ThreeColumns");
      }

      return bRet;
    },

    pdfExitFullScreenBtnVisible: function (bMobile, sLayout) {
      var bRet = false;

      if (!bMobile) {
        bRet = sLayout === "EndColumnFullScreen";
      }

      return bRet;
    },

    detailFullScreenBtnVisible: function (bMobile, sLayout) {
      var bRet = false;

      if (!bMobile) {
        bRet = sLayout.startsWith("TwoColumns");
      }

      return bRet;
    },

    detailExitFullScreenBtnVisible: function (bMobile, sLayout) {
      var bRet = false;

      if (!bMobile) {
        bRet = sLayout === "MidColumnFullScreen";
      }

      return bRet;
    },

    detailCloseBtnVisible: function (sLayout) {
      return sLayout.startsWith("TwoColumns") || sLayout === "MidColumnFullScreen";
    },

    documentTypeState: function (bCreditMemo) {
      return bCreditMemo ? "Warning" : "Information";
    },

    timeLineDateTime: function (oDate, oTime) {
      var oSplitTime = this.formatter.msToTime(oTime.ms);
      oDate.setUTCHours(oSplitTime.hours);
      oDate.setUTCMinutes(oSplitTime.minutes);
      oDate.setUTCSeconds(oSplitTime.seconds);

      return oDate;
    },

    msToTime: function (iMs) {
      var milliseconds = parseInt((iMs % 1000) / 100, 10),
        seconds = parseInt((iMs / 1000) % 60, 10),
        minutes = parseInt((iMs / (1000 * 60)) % 60, 10),
        hours = parseInt((iMs / (1000 * 60 * 60)) % 24, 10);

      hours = hours < 10 ? "0" + hours : hours;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;

      return {
        hours: hours,
        minutes: minutes,
        seconds: seconds,
        milliseconds: milliseconds,
      };
    },

    dateToYYYYMMDD: function (oDate) {
      var iMonth = oDate.getMonth() + 1; // getMonth() is zero-based
      var iDate = oDate.getDate();

      return [oDate.getFullYear(), (iMonth > 9 ? "" : "0") + iMonth, (iDate > 9 ? "" : "0") + iDate].join("");
    },

    UTCToCurrent: function (oDate) {
      return new Date(
        oDate.getUTCFullYear(),
        oDate.getUTCMonth(),
        oDate.getUTCDate(),
        oDate.getUTCHours(),
        oDate.getUTCMinutes(),
        oDate.getUTCSeconds()
      );
    },

    addNewLineBefore: function (sText) {
      return "\n" + sText;
    },

    soldState: function (sSold) {
      return parseFloat(sSold) === 0 ? "Success" : "Error";
    },

    criticalityToStatusState: function (iCrit) {
      var sRet;
      switch (iCrit) {
        case 1:
          sRet = "Error";
          break;
        case 2:
          sRet = "Warning";
          break;
        case 3:
          sRet = "Success";
          break;
        default:
          sRet = "None";
      }

      return sRet;
    },
  };
});
