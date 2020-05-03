import {
  ActorSheet5eCharacter
} from "../../systems/dnd5e/module/actor/sheets/character.js";

class DNDBeyondCharacterSheet5e extends ActorSheet5eCharacter {
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
      if ( !game.user.isGM && this.actor.limited ) return "systems/dnd5e/templates/actors/limited-sheet.html";
      return "modules/dndbeyond-character-sheet/template/dndbeyond-character-sheet.html";
  }

  static get defaultOptions() {
      const options = super.defaultOptions;

      mergeObject(options, {
          classes: ["dnd5e", "sheet", "actor", "character", "dndbcs"],
          width: 1220,
          height: 930
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
      for ( let li of filters ) {
          if ( set.has(li.dataset.filter) ) 
          {
              li.classList.add("active");
              //also do this for all other filters if it was an actions one
              if (ul.dataset.filter == "actions") {
                  const otherUls = document.querySelectorAll('ul[data-filter]');
                  for ( let otherUl of otherUls ) {
                      const otherFilters = otherUl.querySelectorAll(".filter-item");
                      for ( let otherLi of otherFilters ) {
                          if ( set.has(otherLi.dataset.filter) ) otherLi.classList.add("active");
                      }
                  }
                  
              }
          }
      }
  }

  

  /**
 * Organize and classify Owned Items for Character sheets
 * @private
 */
_prepareItems(data) {

  // Categorize items as inventory, spellbook, features, and classes
  const inventory = {
      weapon: { label: "Weapons", items: [], dataset: {type: "weapon"} },
      equipment: { label: "Equipment", items: [], dataset: {type: "equipment"} },
      consumable: { label: "Consumables", items: [], dataset: {type: "consumable"} },
      tool: { label: "Tools", items: [], dataset: {type: "tool"} },
      backpack: { label: "Containers", items: [], dataset: {type: "backpack"} },
      loot: { label: "Loot", items: [], dataset: {type: "loot"} }
    };

    // Partition items by category
    let [items, spells, feats, classes] = data.items.reduce((arr, item) => {
      item.img = item.img || DEFAULT_TOKEN;
      item.isStack = item.data.quantity ? item.data.quantity > 1 : false;
      item.hasUses = item.data.uses && (item.data.uses.max > 0);
      item.isOnCooldown = item.data.recharge && !!item.data.recharge.value && (item.data.recharge.charged === false);
      item.isDepleted = item.isOnCooldown && (item.data.uses.per && (item.data.uses.value > 0));
      item.hasTarget = !!item.data.target && !(["none",""].includes(item.data.target.type));
      if ( item.type === "spell" ) arr[1].push(item);
      else if ( item.type === "feat" ) arr[2].push(item);
      else if ( item.type === "class" ) arr[3].push(item);
      else if ( Object.keys(inventory).includes(item.type ) ) arr[0].push(item);
      return arr;
    }, [[], [], [], []]);

    // Apply active item filters
    if (this._filters.actions.size > 0) {
      items = this._filterItems(items, this._filters.actions);
      spells = this._filterItems(spells, this._filters.actions);
      feats = this._filterItems(feats, this._filters.actions);
    } else {
      items = this._filterItems(items, this._filters.inventory);
      spells = this._filterItems(spells, this._filters.spellbook);
      feats = this._filterItems(feats, this._filters.features);
    }
    

    //********************************************************************************** THIS IS THE SORTING CODE *****************************************************/*
    items = items.sort(function (a, b) {
      return a.name.localeCompare( b.name );
    });
    spells = spells.sort(function (a, b) {
      return a.name.localeCompare( b.name );
    });
    feats = feats.sort(function (a, b) {
      return a.name.localeCompare( b.name );
    });
    //********************************************************************************** END SORTING CODE **************************************************************/

    // Organize Spellbook
    const spellbook = this._prepareSpellbook(data, spells);
    const nPrepared = spells.filter(s => {
      return (s.data.level > 0) && (s.data.preparation.mode === "prepared") && s.data.preparation.prepared;
    }).length;

    // Organize Inventory
    let totalWeight = 0;
    for ( let i of items ) {
      i.data.quantity = i.data.quantity || 0;
      i.data.weight = i.data.weight || 0;
      i.totalWeight = Math.round(i.data.quantity * i.data.weight * 10) / 10;
      inventory[i.type].items.push(i);
      totalWeight += i.totalWeight;
    }
    data.data.attributes.encumbrance = this._computeEncumbrance(totalWeight, data);

    // Organize Features
    const features = {
      classes: { label: "Class Levels", items: [], hasActions: false, dataset: {type: "class"}, isClass: true },
      active: { label: "Active", items: [], hasActions: true, dataset: {type: "feat", "activation.type": "action"} },
      passive: { label: "Passive", items: [], hasActions: false, dataset: {type: "feat"} }
    };
    for ( let f of feats ) {
      if ( f.data.activation.type ) features.active.items.push(f);
      else features.passive.items.push(f);
    }
    classes.sort((a, b) => b.levels - a.levels);
    features.classes.items = classes;

    // Assign and return
    data.inventory = Object.values(inventory);
    data.spellbook = spellbook;
    data.preparedSpells = nPrepared;
    data.features = Object.values(features);
}

  getData() {
      const sheetData = super.getData();

      // Temporary HP
      let hp = sheetData.data.attributes.hp;
      if (hp.temp === 0) delete hp.temp;
      if (hp.tempmax === 0) delete hp.tempmax;
  
      // Resources
      sheetData["resources"] = ["primary", "secondary", "tertiary"].reduce((arr, r) => {
        const res = sheetData.data.resources[r] || {};
        res.name = r;
        res.placeholder = game.i18n.localize("DND5E.Resource"+r.titleCase());
        if (res && res.value === 0) delete res.value;
        if (res && res.max === 0) delete res.max;
        return arr.concat([res]);
      }, []);
  
      // Experience Tracking
      sheetData["disableExperience"] = game.settings.get("dnd5e", "disableExperienceTracking");
  
      //console.log("DNDBeyond-Character-Sheet | sheetData", sheetData);

      // let actor = game.actors.get(sheetData.actor._id);

      // const conditions = canvas.tokens.get(actor.getActiveTokens()[0].data._id).data.effects;
      // let testdata = conditions;

      // console.log("DNDBeyond-Character-Sheet | testdata", testdata);
      
      // Return data for rendering
      return sheetData;
    }

  
}


Hooks.once('init', async function () {

  Handlebars.registerHelper('ifeq', function (a, b, options) {
      if (a == b) { return options.fn(this); }
      return options.inverse(this);
  });
  
  Handlebars.registerHelper('ifnoteq', function (a, b, options) {
      if (a != b) { return options.fn(this); }
      return options.inverse(this);
  });
  
  console.log("DNDBeyond-Character-Sheet | Loaded");

  Actors.registerSheet('dnd5e', DNDBeyondCharacterSheet5e, {types: ['character'], makeDefault: false});
  
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
