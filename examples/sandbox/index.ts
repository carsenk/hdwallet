import "regenerator-runtime/runtime";
import $ from "jquery";
import * as debug from "debug";
import {
  Keyring,
  supportsBTC,
  supportsDebugLink,
  bip32ToAddressNList,
  Events,
  toHexString,
} from "@shapeshiftoss/hdwallet-core";

import { isKeepKey } from "@shapeshiftoss/hdwallet-keepkey";
import { WebUSBKeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey-webusb";

import {
  BTCInputScriptType,
  BTCOutputScriptType,
  BTCOutputAddressType,
} from "@shapeshiftoss/hdwallet-core/src/bitcoin";

// import * from "electrum-cash";

import * as dTxJson from "./json/dTx.json";
import * as ltcTxJson from "./json/ltcTx.json";
import * as dogeTxJson from "./json/dogeTx.json";

const keyring = new Keyring();

const keepkeyAdapter = WebUSBKeepKeyAdapter.useKeyring(keyring);

const log = debug.default("Kronos KeepKey Wallet");

keyring.onAny((name: string[], ...values: any[]) => {
  const [[deviceId, event]] = values;
  const { from_wallet = false, message_type } = event;
  let direction = from_wallet ? "🔑" : "💻";
  debug.default(deviceId)(`${direction} ${message_type}`, event);
  console.log(deviceId, direction, message_type, event);
});

window["keyring"] = keyring;

window.localStorage.debug = "*";
const loggers: { [deviceID: string]: debug.Debugger } = {};

let wallet;
window["wallet"] = wallet;

const $keepkey = $("#keepkey");
const $keepkey2 = $("#keepkey2");
const $keyring = $("#keyring");

const $thenextbutton = $("#nextbutton");
const $nextbutton2 = $("#nextbutton2");
const $nextbuttontx = $("#nextbuttontx");
const $reset = $("#reset");
const $recovery = $("#recovery");
const $pinswap = $("#pinswap");

const $vendorinfo = $("#vendorinfo");
const $labelinfo = $("#labelinfo");
const $deviceidinfo = $("#deviceidinfo");
const $firmwareinfo = $("#firmwareinfo");
const $modelinfo = $("#modelinfo");
const $pairtitle = $("#pairtitle");
const $xpub = $("#xpub");
const $xpubin = $("#xpubin");
const $addrin = $("#addrin");
const $rawtxreturn = $("#rawtxhex");
//const $inputlabel = $("#inputlabel").value;
const $popupinput = $('#popupinput');
const $submitload = $('#submitload');

$keepkey.on("click", async (e) => {
  e.preventDefault();
  wallet = await keepkeyAdapter.pairDevice(undefined, /*tryDebugLink=*/ true);
  listen(wallet.transport);
  window["wallet"] = wallet;
  $("#keyring select").val(wallet.transport.getDeviceID());

  try {
    $pairtitle.text("KeepKey Device Info - Connected");

    let kklabel = await wallet.getLabel();
    $labelinfo.html("Device Label: " + kklabel);

    let vendor = await wallet.getVendor();
    $vendorinfo.text("Vendor: " + vendor);

    let devicesID = await wallet.getDeviceID();
    $deviceidinfo.text("Device ID: " + devicesID);

    let firmware = await wallet.getFirmwareVersion();
    $firmwareinfo.text("Firmware Version: " + firmware);

    let modeli = await wallet.getModel();

    $modelinfo.text(" - Model: " + modeli);

    $keepkey.hide();
    $thenextbutton.show();
    $reset.show();

  } catch(e) {
    $pairtitle.text("An Error Occured, Try to refresh");
    console.log(e);
  };
});

$keepkey2.on("click", async (e) => {
  e.preventDefault();
  wallet = await keepkeyAdapter.pairDevice(undefined, /*tryDebugLink=*/ true);
  listen(wallet.transport);
  window["wallet"] = wallet;
  $("#keyring select").val(wallet.transport.getDeviceID());

  try {
    $pairtitle.text("KeepKey Device Info - Connected");

    let kklabel = await wallet.getLabel();
    $labelinfo.html("Device Label: " + kklabel);

    let vendor = await wallet.getVendor();
    $vendorinfo.text("Vendor: " + vendor);

    let devicesID = await wallet.getDeviceID();
    $deviceidinfo.text("Device ID: " + devicesID);

    let firmware = await wallet.getFirmwareVersion();
    $firmwareinfo.text("Firmware Version: " + firmware);

    let modeli = await wallet.getModel();

    $modelinfo.text(" - Model: " + modeli);

    $keepkey2.hide();
    $nextbuttontx.show();

  } catch(e) {
    $pairtitle.text("An Error Occured, Try to refresh");
    console.log(e);
  };
});



async function deviceConnected(deviceId) {
  let wallet = keyring.get(deviceId);
  if (!$keyring.find(`option[value="${deviceId}"]`).length) {
    $keyring.append(
      $("<option></option>")
        .attr("value", deviceId)
        .text(deviceId + " - " + (await wallet.getVendor()))
    ); 
  }
}

(async () => {
  try {
    await keepkeyAdapter.initialize(undefined, /*tryDebugLink=*/ true, /*autoConnect=*/ false);
  } catch (e) {
    console.error("Could not initialize KeepKeyAdapter", e);
  }

  for (const [deviceID, wallet] of Object.entries(keyring.wallets)) {
    await deviceConnected(deviceID);
  }
  $keyring.change(async (e) => {
    if (wallet) {
      await wallet.disconnect();
    }
    let deviceID = $keyring.find(":selected").val() as string;
    wallet = keyring.get(deviceID);
    if (wallet) {
      if (wallet.transport) {
        await wallet.transport.connect();
        if (isKeepKey(wallet)) {
          console.log("try connect debuglink");
          await wallet.transport.tryConnectDebugLink();
        }
      }
      await wallet.initialize();
    }
    window["wallet"] = wallet;
  });
  wallet = keyring.get();
  window["wallet"] = wallet;
  if (wallet) {
    let deviceID = wallet.getDeviceID();
    $keyring.val(deviceID).change();
  } 

  keyring.on(["*", "*", Events.CONNECT], async (deviceId) => {
    await deviceConnected(deviceId);
  });

  keyring.on(["*", "*", Events.DISCONNECT], async (deviceId) => {
    $keyring.find(`option[value="${deviceId}"]`).remove();
  });
})();

window["handlePinDigit"] = function (digit) {
  let input = document.getElementById("#pinInput");
  if (digit === "") {
    input.value = input.value.slice(0, -1);
  } else {
    input.value += digit.toString();
  }
};

window["pinOpen"] = function () {
  document.getElementById("#pinModal").className = "modale opened";
};

window["pinEntered"] = function () {
  let input = document.getElementById("#pinInput");
  wallet.sendPin(input.value);
  document.getElementById("#pinModal").className = "modale";
};

window["passphraseOpen"] = function () {
  document.getElementById("#passphraseModal").className = "modale opened";
};

window["passphraseEntered"] = function () {
  let input = document.getElementById("#passphraseInput");
  wallet.sendPassphrase(input.value);
  document.getElementById("#passphraseModal").className = "modale";
};

function listen(transport) {
  if (!transport) return;

  transport.on(Events.PIN_REQUEST, (e) => {
    window["pinOpen"]();
  });

  transport.on(Events.PASSPHRASE_REQUEST, (e) => {
    window["passphraseOpen"]();
  });
}

const $yes = $("#yes");
const $no = $("#no");
const $cancel = $("#cancel");

$yes.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) return;

  if (!supportsDebugLink(wallet)) return;

  await wallet.pressYes();
});

$no.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) return;

  if (!supportsDebugLink(wallet)) return;

  await wallet.pressNo();
});

$cancel.on("click", async (e) => {
  e.preventDefault();

  if (!wallet) return;

  await wallet.cancel();
});

const denariusBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 116, 0x80000000 + 0],
};

const ltcBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0, 0, 0],
};

$thenextbutton.on("click", async (e) => {
  e.preventDefault();

  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }

  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: denariusBip44.addressNList.concat([0, 0]),
      coin: "Denarius",
      scriptType: denariusBip44.scriptType,
      showDisplay: true,
    });

    $pairtitle.text(res);
    $addrin.val(res);

    const result = await wallet.getPublicKeys([
      {
        addressNList: denariusBip44.addressNList.concat([0, 0]), //[0x80000000 + 44, 0x80000000 + 116, 0x80000000 + 0],
        curve: "secp256k1",
        showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        coin: "Denarius",
      },
    ]);

    console.log(result[0]);
    
    var xpub = JSON.stringify(result[0].xpub);

    //$xpub.show();
    //$xpub.text(result[0].xpub);
    $xpubin.val(result[0].xpub);

    $thenextbutton.hide();
    $nextbutton2.show();

  } else {

    let label = await wallet.getLabel(); // should be DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp for alcohol abuse
    $pairtitle.text(label + " does not support D, update firmware");

  }


});

$nextbuttontx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    //this works const txid = "1de79c706f34c81bbefad49a9ff8d12b6ca86b77605a1998505e4f8792a5892d";
    const txid = "fb11728d7afbf705279dbe3ce8d964b903b23d1d75cda3e0b27b24e008321dca";
    // this works const hex = "010000000196f5704ef948abb958f32ff216112d3283142baf50723833c378882c14a9adea010000006a47304402207c899ba5197a23b1f3cc4b3621abbc682b5142f3ae29af4b951952573f6c82a002203fd7f038aa8403d2c06fd32c237ab4e915939c25aafa7bcb06fb0ddd46afbfd3012103eddbce765b6d7ae1c91b779696e8b8f72ce444070f83beba2f823af76fd4dfebffffffff0290680a00000000001976a91491e975a0238fa1dfff703e50f062e2544a3e372088aca6791100000000001976a91415757f526dc67b52ae9f74918db532eebc39608688ac00000000";
    const hex ="010000003b4afc5e01acf0bb4ad63d880e590b80c5a3ee66e950fddeb8c5cc72578a1c89bbcf597251010000006a473044022003ddac31ed3d2dffc50169c0bcece812207876467d9863d78d6064d92349b915022066fc8187ec60dbff205878c570e13f7ca5377ebb8b5181d206a844f968942de6012103f5b29d1f63e06568912c4ca0ca2bf8827ed2bef532446ef3d379590e0d3316aeffffffff02a0bb0d00000000001976a914032c2288699a64540e81e9980b3e6598040ba10288aca8609200000000001976a9145ef9da5d87a0c17eb8dc08ad4c14ab948af8777b88ac00000000";
    // Raw TX HEX of TXID getrawtransaction

    const inputs = [
      {
        addressNList: denariusBip44.addressNList.concat([0, 0]),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(21602580),
        vout: 1, 
        txid,
        segwit: false,
        tx: dTxJson,
        hex,
      },
    ];

    const outputs = [
      {
        address: "DFaSN5xF8Y7o9ifFuBcHQsub9UoT3yn7kx",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(261614), //Send 0.00261614 D //Wants to spend 355.77118484 D on fees //Really want to send 355.77380098 D? Total of vout n 1
        isChange: false,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "Denarius",
      inputs,
      outputs,
      version: 1,
      locktime: 0,
    });

    $pairtitle.text(res.serializedTx); // TODO: Fails for Ledger: "TransportStatusError: Ledger device: Invalid data received (0x6a80)"
    $rawtxreturn.val(res.serializedTx); // Submit Raw TX Hex for Broadcasting
    console.log(res.serializedTx);

  } else {
    let label = await wallet.getLabel();
    $pairtitle.text(label + " does not support Denarius");
  }

});

const $dSign = $('#dSign');

$dSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcSignMessage({
      addressNList: denariusBip44.addressNList.concat([0, 0]),
      coin: "Denarius",
      scriptType: BTCInputScriptType.SpendAddress,
      message: "Ancient Money For A New World",
    });
    $pairtitle.val(res.address + " " + res.signature);
    // Address: LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    // Signature: 1f835c7efaf953e059e7074afa954c5a8535be321f48e393e125e2a839d1721b495b935df1162c2b69f3e698167b75ab8bfd2c9c203f6070ff701ebca49653a056
  } else {
    let label = await wallet.getLabel();
    $pairtitle.val(label + " does not support Denarius");
  }
});

const $dVerify = $('#dVerify');

$dVerify.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcVerifyMessage({
      address: "D5RsSNzzfeiLyDrhVkPePv8DK4Ayxyi1fu",
      coin: "Denarius",
      signature: "IB5ri16Bi5mOXc7t9QUTD8OD9rhV3sq9OQEHdmpK/9FafcLDylkSwQnVaMMHmgdf6nF2YnhAPys2M1N6rS1hQCk=",
      message: "Ancient Money For A New World",
    });
    $pairtitle.text(res ? "✅" : "❌");
  } else {
    let label = await wallet.getLabel();
    $pairtitle.text(label + " does not support D");
  }
});

$reset.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }
  $recovery.show();
  $pinswap.show();
  $pairtitle.text("✅ Check Device");
  wallet.wipe();
  $reset.hide();
});

$recovery.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }
  
  // $pairtitle.text("✅ Setting up Device");
  $reset.show();
  // wallet.changePin();

  document.getElementById("#popupinput").className = "modale opened";

});

$pinswap.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }
  //$popupinput.show();
  wallet.changePin();

  // $pairtitle.text("✅ Check Device");
});

$submitload.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $pairtitle.text("No wallet?");
    return;
  }

  // const $inputmem = $("#inputmem").value;

  const $inputmem = document.getElementById("inputmem").value;
  const $inputlabel = document.getElementById("inputlabel").value;
  // document.getElementById("demo").innerHTML = x;

  wallet.loadDevice({
    mnemonic: $inputmem,
    passphrase: true,
    pin: true,
    label: $inputlabel,
    // /*Test seed:*/ "banana cat attract immune promote dilemma join mosquito glow educate square donate tag adult piece swim battle category deposit strong month goose speak stomach",
  });

  // wallet.applySettings({    
  //   label: $inputlabel,
  //   usePassphrase: true,
  //   autoLockDelayMs: 60000,
  // });

  document.getElementById("#popupinput").className = "modale closed";
  $pairtitle.text("✅ New Seed Phrase Setup!");
  $recovery.hide();
  $reset.hide();

});


// $doPing.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $manageResults.val("No wallet?");
//     return;
//   }
//   const result = await wallet.ping({ msg: "Denarius Kronos Test Ping", button: true });
//   $manageResults.val(result.msg);
// });


// /*
//       Denarius
//         * segwit: false
//         * mutltisig: true

//  */

// const $denariusAddr = $("#denariusAddr");
// const $denariusTx = $("#denariusTx");
// const $denariusResults = $("#denariusResults");

// // const denariusBip44 = {
// //   scriptType: BTCInputScriptType.SpendAddress,
// //   addressNList: [0x80000000 + 44, 0x80000000 + 116, 0x80000000 + 0],
// // };
// $denariusAddr.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $denariusResults.val("No wallet?");
//     return;
//   }
//   if (supportsBTC(wallet)) {
//     let res = await wallet.btcGetAddress({
//       addressNList: denariusBip44.addressNList.concat([0, 0]),
//       coin: "Denarius",
//       scriptType: denariusBip44.scriptType,
//       showDisplay: true,
//     });
//     $denariusResults.val(res);
//   } else {
//     let label = await wallet.getLabel(); // should be DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp for alcohol abuse
//     $denariusResults.val(label + " does not support D");
//   }
// });

// $denariusTx.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $denariusResults.val("No wallet?");
//     return;
//   }
//   if (supportsBTC(wallet)) {
//     const txid = "4ab8c81585bf61ddcba03f4b2f4958b3800d68b02874f4955e258775cb3e7068";
//     const hex =
//       "01000000048831c8a8c7f06e5f4ecccb789cc9de0fc843208797652ff9edf6edaa64d02789010000006a473044022070e25a73ceebaf5b3a35d5e4930ebba77957a2fe485b9dcbaf982a7c63d4baab02206e75dcc4258db29a2803d6a14112d3d81f93ec23f9b2a61bfe8102d764d7c6390121031b49bb2c43daac784377bcca83c41f781007626e6e8b66cda9f57fed11494359feffffff52a8a6ac8ea9b436069c160caae68b2eb0a5b713a7b838179833af5a339e48e9000000006a47304402206b3aa1a4656d4859b87512a5fb50c73f0f6e05d45fa027850a3e1eb4f927675402201fb1c52d85380727d28bea7a21d434bed2d57d3a120082c6c69d578b4f3da07c0121033034cf66b3b153a81713b3ddbcdffd92c34c46510353cf01b237fcfbcf1348bdfeffffff35f6938fd9d9077d913bd6cfc546cbadb17d4db6ccb67d87a1f89e562d6bed8e000000006b483045022100a0e8a73fc2358a206a73a78582fd7ebba2fb08487aca78aaa89cbf7f9805da0102207704f4f27ff6297b11acd74f8e3f28d924c4006ac0d37dd37bbdba1ef8f401ae0121038ac65cabea63b92d3aabd3f17591c23bbec73b87220a3f0325fe2de9e62107e3feffffff07cd534960ea57fdb4195d3de7dae1feb1e630a022c08baca2f2423f4d190a27010000006a47304402203c89ade05e93ee9cb9bfa0703be55a76abd40330108a5e5272bcd0c8338c35df022042d8cb34275e87df1b77f19e9dde5da553b98bca67c1c332a53392b32d55ba580121038291eee31aa046a00938dda548c0c948f57bf5dc6e534abbe0d5078a6ce083a0feffffff02b8adfa31000000001976a9146ef1cda5c24d47934853aeccce14163e3a18be1388ac02bd9348080000001976a914d3f096cbc84bd6daf7e7fe2700c32548ca2f23f188acadd31600";

//     const inputs = [
//       {
//         addressNList: denariusBip44.addressNList.concat([0, 0]),
//         scriptType: BTCInputScriptType.SpendAddress,
//         amount: String(133733310033),
//         vout: 1,
//         txid: txid,
//         segwit: false,
//         tx: dogeTxJson,
//         hex,
//       },
//     ];

//     const outputs = [
//       {
//         address: "DMEHVGRsELY5zyYbfgta3pAhedKGeaDeJd",
//         addressType: BTCOutputAddressType.Spend,
//         scriptType: BTCOutputScriptType.PayToAddress,
//         amount: String(133733310033),
//         isChange: false,
//       },
//     ];

//     const res = await wallet.btcSignTx({
//       coin: "Denarius",
//       inputs,
//       outputs,
//       version: 1,
//       locktime: 0,
//     });
//     $denariusResults.val(res.serializedTx); // TODO: Fails for Ledger: "TransportStatusError: Ledger device: Invalid data received (0x6a80)"
//   } else {
//     let label = await wallet.getLabel();
//     $denariusResults.val(label + " does not support Denarius");
//   }
// });

// /*
//       Dogecoin
//         * segwit: false
//         * mutltisig: true

//  */

// const $dogeAddr = $("#dogeAddr");
// const $dogeTx = $("#dogeTx");
// const $dogeResults = $("#dogeResults");

// const dogeBip44 = {
//   scriptType: BTCInputScriptType.SpendAddress,
//   addressNList: [0x80000000 + 44, 0x80000000 + 3, 0x80000000 + 0],
// };
// $dogeAddr.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $dogeResults.val("No wallet?");
//     return;
//   }
//   if (supportsBTC(wallet)) {
//     let res = await wallet.btcGetAddress({
//       addressNList: dogeBip44.addressNList.concat([0, 0]),
//       coin: "Dogecoin",
//       scriptType: dogeBip44.scriptType,
//       showDisplay: true,
//     });
//     $dogeResults.val(res);
//   } else {
//     let label = await wallet.getLabel(); // should be DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp for alcohol abuse
//     $dogeResults.val(label + " does not support DOGE");
//   }
// });

// $dogeTx.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $dogeResults.val("No wallet?");
//     return;
//   }
//   if (supportsBTC(wallet)) {
//     const txid = "4ab8c81585bf61ddcba03f4b2f4958b3800d68b02874f4955e258775cb3e7068";
//     const hex =
//       "01000000048831c8a8c7f06e5f4ecccb789cc9de0fc843208797652ff9edf6edaa64d02789010000006a473044022070e25a73ceebaf5b3a35d5e4930ebba77957a2fe485b9dcbaf982a7c63d4baab02206e75dcc4258db29a2803d6a14112d3d81f93ec23f9b2a61bfe8102d764d7c6390121031b49bb2c43daac784377bcca83c41f781007626e6e8b66cda9f57fed11494359feffffff52a8a6ac8ea9b436069c160caae68b2eb0a5b713a7b838179833af5a339e48e9000000006a47304402206b3aa1a4656d4859b87512a5fb50c73f0f6e05d45fa027850a3e1eb4f927675402201fb1c52d85380727d28bea7a21d434bed2d57d3a120082c6c69d578b4f3da07c0121033034cf66b3b153a81713b3ddbcdffd92c34c46510353cf01b237fcfbcf1348bdfeffffff35f6938fd9d9077d913bd6cfc546cbadb17d4db6ccb67d87a1f89e562d6bed8e000000006b483045022100a0e8a73fc2358a206a73a78582fd7ebba2fb08487aca78aaa89cbf7f9805da0102207704f4f27ff6297b11acd74f8e3f28d924c4006ac0d37dd37bbdba1ef8f401ae0121038ac65cabea63b92d3aabd3f17591c23bbec73b87220a3f0325fe2de9e62107e3feffffff07cd534960ea57fdb4195d3de7dae1feb1e630a022c08baca2f2423f4d190a27010000006a47304402203c89ade05e93ee9cb9bfa0703be55a76abd40330108a5e5272bcd0c8338c35df022042d8cb34275e87df1b77f19e9dde5da553b98bca67c1c332a53392b32d55ba580121038291eee31aa046a00938dda548c0c948f57bf5dc6e534abbe0d5078a6ce083a0feffffff02b8adfa31000000001976a9146ef1cda5c24d47934853aeccce14163e3a18be1388ac02bd9348080000001976a914d3f096cbc84bd6daf7e7fe2700c32548ca2f23f188acadd31600";

//     const inputs = [
//       {
//         addressNList: dogeBip44.addressNList.concat([0, 0]),
//         scriptType: BTCInputScriptType.SpendAddress,
//         amount: String(35577380098),
//         vout: 1,
//         txid: txid,
//         segwit: false,
//         tx: dogeTxJson,
//         hex,
//       },
//     ];

//     const outputs = [
//       {
//         address: "DMEHVGRsELY5zyYbfgta3pAhedKGeaDeJd",
//         addressType: BTCOutputAddressType.Spend,
//         scriptType: BTCOutputScriptType.PayToAddress,
//         amount: String(35577380098),
//         isChange: false,
//       },
//     ];

//     const res = await wallet.btcSignTx({
//       coin: "Dogecoin",
//       inputs,
//       outputs,
//       version: 1,
//       locktime: 0,
//     });
//     $dogeResults.val(res.serializedTx); // TODO: Fails for Ledger: "TransportStatusError: Ledger device: Invalid data received (0x6a80)"
//   } else {
//     let label = await wallet.getLabel();
//     $dogeResults.val(label + " does not support Litecoin");
//   }
// });

// /*
//        DigiByte
//         * segwit: true
//         * multisig: true

//  */
// const $dgbAddr = $("#dgbAddr");
// const $dgbTx = $("#dgbTx");
// const $dgbResults = $("#dgbResults");

// const dgbBip44 = {
//   scriptType: BTCInputScriptType.SpendAddress,
//   addressNList: [0x80000000 + 44, 0x80000000 + 20, 0x80000000 + 0],
// };

// $dgbAddr.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $dgbResults.val("No wallet?");
//     return;
//   }
//   if (supportsBTC(wallet)) {
//     let res = await wallet.btcGetAddress({
//       addressNList: dgbBip44.addressNList.concat([0, 0]),
//       coin: "DigiByte",
//       scriptType: dgbBip44.scriptType,
//       showDisplay: true,
//     });
//     $dgbResults.val(res);
//   } else {
//     let label = await wallet.getLabel();
//     $dgbResults.val(label + " does not support Dash");
//   }
// });

// $dgbTx.on("click", async (e) => {
//   e.preventDefault();
//   if (!wallet) {
//     $dgbResults.val("No wallet?");
//     return;
//   }

//   // // use all mnemonic as there is no valid tx on alcohol abuse to use for Native signing
//   // await wallet.loadDevice({
//   //   mnemonic: "all all all all all all all all all all all all",
//   // });

//   if (supportsBTC(wallet)) {
//     const inputs = [
//       {
//         addressNList: dgbBip44.addressNList.concat([0, 0]),
//         scriptType: BTCInputScriptType.SpendAddress,
//         amount: String(480000000),
//         vout: 15,
//         txid: "be150359df4123b379f1f12de978bfced92644645da17b97c7613879f4306a90",
//         tx: null,
//         hex:
//           "01000000010b89406fd53f648dbf5cc7a46443794487684833c4bb7a067c86bdcf88362d4b010000006b4830450221009b38f01ca6b06c9fddb5d17ecaf306b140181074e06d50d38b4f61bc81c34d0202200eb9d37f551f6599a3488a8215cf53a347ced76b1dfb1c171855390a5576cd5a012102ee6d4720bc42ae172a1b1fbd1c0fccf4b9f364054f5ba1681f5e206c3b3a4d65ffffffff14486b9e7e750000001976a914f972645c9db830433fe9672b55452b4310c9501288ac0066a957160000001976a914584df25dff6f9eff9a86f2a49807249417913de288ac00bb4547170000001976a914cf934b123f7d1d0e6ecceff45dd881c6b3a1a7c588ac0020bcbe000000001976a91445ef856d2aa149ad66c4f98b115cd53ac88bcbbe88ac0063fe4e090000001976a91464d0c1a15eedb75f74a05b7282bbfc425e9a41ef88ac008b10e72e0300001976a91423cacb5aa41a375e057a38920396e889dd431e4d88ac6b884a1e0f0000001976a9149a32a47d48569012e3539a4be52c9436af9337a788ac003d7bc1210000001976a9147ba2fcb7d0d1321d8501019c2d9f68848e70bf7a88ac00389c1c0000000017a914d3b07c1aaea886f8ceddedec440623f812e49ddc87599e220afc0000001976a914e05ed2af3b5e20f3481e17fa26ef220a70237d7f88ac5475e2d91c0000001976a9147403f2f35e9c9e1f465a34d03afb7ff85f50770588acc9a9ce043c0000001976a914510fffca0668d410aea742e95a2fefa7952f695e88acf8f71c55890000001976a914916014ab503133671da74cfa18570debc332d63888acdfdeae45000000001976a9149cfc24e08cb9189839b0b5c973dec6cc1e1e662488ac8d10f92b954000001976a91433eed4c1b486b6c51824eab5a5d25dc47e0acc7e88ac00389c1c000000001976a914a4b8f22d44a76f96e035a75e01d55fc4cad081e188ac855ed4696f0000001976a9148d18463cb1e415242e49dfd3154a0edfcf16f25988ac439d5ff7180000001976a9144227b8ea4d92a707402bc96378a19ff5d83c5f9088ac9d2724980e0000001976a914b721f681fdbf9541cc5e2aed31a1fbb16a727fdf88ac893d1cf2e20000001976a91442f1d1103b1e9e10efdb5a0b1b88dfe627467dc288ac00000000",
//       },
//       {
//         addressNList: dgbBip44.addressNList.concat([0, 0]),
//         scriptType: BTCInputScriptType.SpendAddress,
//         amount: String(10000000),
//         vout: 0,
//         txid: "528ec23eaf123282e9bce297ebb3edfb05e8b4d5875cbc9c271a98d72a202340",
//         tx: null,
//         hex:
//           "0100000001442377be8a2c1d8769dd417382f8ac1a35f33c86de89e2dcf997522e7ae9e6b7000000006a473044022004f4072085e7a9e1f84cb77653f02f7a5b301b3d3514fe750e86d42f617c429a0220338f779601a38ff18c7adfd1a1ccd8f723de12ff4f9c41b7b72f1c0f6f4738ac012103723d91852ec39078fb9d167fe2c4e86be1325057d707ab69ce625699d86a537fffffffff0280969800000000001976a914a4b8f22d44a76f96e035a75e01d55fc4cad081e188ac66e00c16000000001976a9144afe51fbe5fb6cd4814ce74b31d7535a5f4a63bc88ac00000000",
//       },
//     ];

//     const outputs = [
//       {
//         address: "SWpe93hQL2pLUDLy7swsDPWQJGCHSsgmun",
//         addressType: null,
//         scriptType: BTCOutputScriptType.PayToMultisig,
//         amount: String(400000000),
//         isChange: false,
//       },
//       {
//         address: "DNLcBry65dHehGExGYjBkM8kxDYr7mZ3BT",
//         addressType: null,
//         scriptType: BTCOutputScriptType.PayToAddress,
//         relpath: "1/9",
//         amount: String(90000000),
//         isChange: true,
//         index: 9,
//       },
//     ];

//     const res = await wallet.btcSignTx({
//       coin: "DigiByte",
//       inputs,
//       outputs,
//       version: 1,
//       locktime: 0,
//     });
//     $dgbResults.val(res.serializedTx);
//   } else {
//     let label = await wallet.getLabel();
//     $dgbResults.val(label + " does not support Dash");
//   }

//   // // set mnemonic back to alcohol abuse
//   // await wallet.loadDevice({ mnemonic });
// });