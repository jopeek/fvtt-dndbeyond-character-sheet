class DNDBeyondCharacterSheet5e extends dnd5e.applications.actor.ActorSheet5eCharacter {
  constructor(...args) {
    super(...args);

    /**
     * Track the set of item filters which are applied
     * @type {Set}
     */
    this._filters = {
      inventory: new Set(),
      spellbook: new Set(),
      features: new Set(),
      actions: new Set()
    };
  }


  get template() {
    if (!game.user.isGM && this.actor.limited) return "systems/dnd5e/templates/actors/limited-sheet.hbs";
    return "modules/dndbeyond-character-sheet/template/dndbeyond-character-sheet.html";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;

    mergeObject(options, {
      classes: ["dnd5e", "sheet", "actor", "character", "dndbcs"],
      width: 1220,
      height: 940,
      blockActionsTab: true
    });
    return options;
  }

  /**
   * Iinitialize Item list filters by activating the set of filters which are currently applied
   * @private
   */
  _initializeFilterItemList(i, ul) {
    const set = this._filters[ul.dataset.filter];
    const filters = ul.querySelectorAll(".filter-item");
    for (let li of filters) {
      if (set.has(li.dataset.filter)) li.classList.add("active");
    }
  }


  
  

  /* -------------------------------------------- */

  activateListeners(html) {
    super.activateListeners(html);
    let searchInput = html.find(".filter-search input");
    searchInput.on("input", function() {
      filterInventoryList(this, html);
    });
  }


  async getData() {
    const sheetData = await super.getData();
    
    // Temporary HP
    console.log("dndb", sheetData);
    let hp = sheetData.system.attributes.hp;
    if (hp.temp === 0) delete hp.temp;
    if (hp.tempmax === 0) delete hp.tempmax;

    // Resources
    sheetData["resources"] = ["primary", "secondary", "tertiary"].reduce((arr, r) => {
      const res = sheetData.system.resources[r] || {};
      res.name = r;
      res.placeholder = game.i18n.localize("DND5E.Resource" + r.titleCase());
      if (res && res.value === 0) delete res.value;
      if (res && res.max === 0) delete res.max;
      return arr.concat([res]);
    }, []);

    // Experience Tracking
    sheetData["disableExperience"] = game.settings.get("dnd5e", "disableExperienceTracking");

    console.log("DNDBeyond-Character-Sheet | sheetData", sheetData);

    return sheetData;
  }


}

async function filterInventoryList(input, html) {
  
  let id = $(input).attr("id");
  let value = $(input).val().toLowerCase();
  let searchTarget;

  switch (id) {
    case "inventory-search":
      searchTarget = html.find(
        ".inventory-list:not(.actions-list):not(.spellbook-list):not(.features-list) .item-name.rollable"
      );
      break;
      case "actions-search":
        searchTarget = html.find(
          ".actions-list:not(.spellbook-list):not(.features-list) .item-name.rollable"
        );
        break;
    case "spellbook-search":
      searchTarget = html.find(
        ".spellbook-list .item-name.rollable"
      );
      break;
    case "features-search":
      searchTarget = html.find(".features-list .item-name.rollable");
      break;
  }

  searchTarget.each(function() {
    let itemName = $(this).text().toLowerCase().trim();
    console.log(itemName, itemName.indexOf(value.toLowerCase()));

    if (itemName.indexOf(value.toLowerCase()) >= 0) {
      $(this).closest(".item").removeClass("filtered").show();
    } else {
      $(this).closest(".item").addClass("filtered").hide();
    }

  });
  
}

Hooks.once('init', async function () {

  Handlebars.registerHelper('ifeq', function (a, b, options) {
    if (a == b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper('ifprepared', function (preparedmode, isprepared, options) {
    if (preparedmode == "atwill" || preparedmode == "innate" || preparedmode == "always" || isprepared) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper('ifnoteq', function (a, b, options) {
    if (a != b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  console.log("DNDBeyond-Character-Sheet | Loaded");

  Actors.registerSheet('dnd5e', DNDBeyondCharacterSheet5e, {
    types: ['character'],
    makeDefault: false
  });

});

Hooks.on('ready', () => {
  try {
    window.BetterRolls.hooks.addActorSheet("DNDBeyondCharacterSheet5e");
    window.BetterRolls.hooks.addItemSheet("DNDBeyondCharacterSheet5e");
    console.log("DNDBeyond-Character-Sheet | Enabled support for Better Rolls 5e");
  } catch (error) {
    console.log("DNDBeyond-Character-Sheet | Better Rolls 5e module not installed - no big deal, carry on!");
  }


});