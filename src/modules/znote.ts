import { config } from "../../package.json";
import { getString } from "../utils/locale";

export class znote {
  static registerZnoteRightClickMenuItem() {
    const menuIcon = `chrome://${config.addonRef}/content/icons/znote.png`;
    // item menuitem with icon
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      label: getString("menuitem.label2"),
      //commandListener: (ev) => addon.hooks.onDialogEvents("dialogZnote"),
      commandListener: (ev) => znote.translateNote(),
      icon: menuIcon,
    });
  }

  static registerShortcuts() {
    ztoolkit.Shortcut.register("event", {
      id: `${config.addonRef}-key-get-txt`,
      key: "B",
      modifiers: "alt",
      callback: (keyOptions) => {
        addon.hooks.onShortcuts("getTxt");
      },
    });
  }

  static getTxtCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: "getTxt",
        type: "default",
      })
      .show();
    let noteIDs = znote.getNoteIDs();
    window.alert("成功获取笔记ID" + noteIDs);
  }

  static async dialog() {
    const dialogData: { [key: string | number]: any } = {
      inputValue: "znote",
      checkboxValue: true,
      loadCallback: () => {
        ztoolkit.log(dialogData, "Dialog Opened!");
      },
      unloadCallback: () => {
        ztoolkit.log(dialogData, "Dialog closed!");
      },
    };
    const dialogHelper = new ztoolkit.Dialog(10, 2)
      .addCell(0, 0, {
        tag: "h1",
        properties: { innerHTML: getString("dialog.label") },
      })
      .addCell(1, 0, {
        tag: "h3",
        properties: { innerHTML: "功能说明" },
        styles: {
          width: "50px",
        },
      })
      .addCell(3, 0, {
        tag: "label",
        namespace: "html",
        attributes: {
          for: "dialog-checkbox",
        },
        properties: { innerHTML: "bind:checkbox" },
      })
      .addCell(
        3,
        1,
        {
          tag: "input",
          namespace: "html",
          id: "dialog-checkbox",
          attributes: {
            "data-bind": "checkboxValue",
            "data-prop": "checked",
            type: "checkbox",
          },
          properties: { label: "Cell 1,0" },
        },
        false
      )
      .addCell(
        7,
        0,
        {
          tag: "button",
          namespace: "html",
          attributes: {
            type: "button",
          },
          listeners: [
            {
              type: "click",
              listener: (e: Event) => {
                addon.hooks.onDialogEvents("filePickerExample");
              },
            },
          ],
          children: [
            {
              tag: "div",
              styles: {
                padding: "2.5px 15px",
              },
              properties: {
                innerHTML: "example:filepicker",
              },
            },
          ],
        },
        false
      )
      .addButton("Confirm", "confirm")
      .addButton("Cancel", "cancel")
      .addButton("Help", "help", {
        noClose: true,
        callback: (e) => {
          dialogHelper.window?.alert(
            "Help Clicked! Dialog will not be closed."
          );
        },
      })
      .setDialogData(dialogData)
      .open("Dialog Example");
    await dialogData.unloadLock.promise;
    ztoolkit.getGlobal("alert")(
      `Close dialog with ${dialogData._lastButtonId}.\nCheckbox: ${dialogData.checkboxValue}\nInput: ${dialogData.inputValue}.`
    );
    ztoolkit.log(dialogData);
  }

  static async getNoteMD(noteID: number) {
    var note = Zotero.Items.get(noteID);
    let mdtxt = ''
    //betterNote 插件版本
    let betterNoteVersion = await znote.getAddonVersion('Knowledge4Zotero@windingwind.com')
    if (betterNoteVersion.startsWith('1')) {
      let dir = ''
      mdtxt = await Zotero.BetterNotes.api.convert.note2md(note, dir,

        {
          keepNoteLink: false,
          withYAMLHeader: false,
          skipSavingImages: true
        })
    } else {
      mdtxt = await Zotero.BetterNotes.NoteParse.parseNoteToMD(note, {
        withMeta: false,
        skipSavingImages: true,
        backend: "turndown",
      });
    }
    

    return mdtxt;
  }

  static getNoteIDs() {
    var items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!items.length) {
      return [];
    }

    var noteIDs: number[] = [];
    for (let item of items) {
      if (item.isRegularItem()) {
        //拼接笔记ID数组
        noteIDs = noteIDs.concat(item.getNotes());
      }
      // 独立笔记
      else if (item.isNote() && !item.parentItem) {
        noteIDs.push(item.id);
      }
      // 条目的子项(子笔记, pdf 等)
      else {
        var parentItem = item.parentItem!;
        noteIDs = noteIDs.concat(parentItem.getNotes());
      }
    }

    // 判断 tag 筛选需要翻译的笔记
    var tagNamesExclude: string[] = ['antmantr', 'antman'];
    if (!tagNamesExclude.length) {
      return [...new Set(noteIDs)];
    }
    if (noteIDs) {
      var noteTodoIDs = [];
      for (let aNOteID of noteIDs) {
        let aNoteTags = Zotero.Items.get(aNOteID).getTags();
        if (aNoteTags.length) {
          for (let t of aNoteTags) {
            if (!tagNamesExclude.indexOf(t.tag.toLowerCase())) {
              noteTodoIDs.push(aNOteID);
            }
          }
        } else {
          noteTodoIDs.push(aNOteID);
        }
      }
    } else {
      return [];
    }
    // set解构赋值去重
    return [...new Set(noteTodoIDs)];
  }
  static async translateNote() {

    let noteID = Zotero.getActiveZoteroPane().getSelectedItems()[0].id
    let mdTxt = await znote.getNoteMD(noteID) 
    let transresult = await znote.translate(mdTxt)
    Zotero.getActiveZoteroPane().selectItem(noteID)
    let noteDuplicate = await Zotero.getActiveZoteroPane().duplicateSelectedItem()
    noteDuplicate.setNote(transresult);
    await noteDuplicate.saveTx()
  }
  static async translateNotes() {

  }
  static async translate(sourceTxt: string) {
    var transresult = await Zotero.PDFTranslate.api.translate(sourceTxt)
    window.alert(transresult.result)
    return transresult.result
  }

  static async getAddonVersion(id: string) {
    var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
    var addon = await AddonManager.getAddonByID(id);
    return addon.version
  }

  static znoteNotifierCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: "Selected note!",
        type: "success",
        progress: 100,
      })
      .show();
  }
}



