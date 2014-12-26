/*
 * Pekoe Form uses a custom schema and template to generate an HTML Form
 * whose output is XML
 * Copyright (C) 2009,2010,2011-2014 Geordie Springfield Pty Ltd (Australia)
 * Author: Alister Pillow alisterhp@me.com

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as
 published by the Free Software Foundation, either version 3 of the
 License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
 
var gs;
if (!gs) { gs = {}; }
if (!gs.Pekoe) { gs.Pekoe = {}; }

if (!gs.Pekoe.BureauAG) { gs.Pekoe.BureauAG = function (navPanelId) {
		this.attachmentPointId = navPanelId; // it happens to be a DIV
		this.listeners = [];
		this.chosenItem = null;
		this.topList = null;
		this.maxLevel = 0;
		this.BAGPREFIX = "bagS"; // this must match the CSS div names
		this.MAXLIST = 7; //gs.Pekoe.Config.get("BAG.MAXLIST");
//		this.observers = gs.Pekoe.Accessories.EventManager();
}; }

/*

 *
 * Next major change is MultiTenancy and IndexedDB.
 * Multitenancy means that the BAG will change according to the Tenant - for ME or other ADMIN users (or MULTI-TENANT clients)
 */

gs.Pekoe.BureauAG.prototype = { // christ its a fucking prototype based thing. But there should only be one of them

	load : function (deferredLoad) {
		var self = this;
		this.deferred = deferredLoad;
		$.get("/exist/pekoe-app/templates.xql?get=list", function (d) {
			self.init(d);
		});
	},
	init : function (list) {
//		this.attachmentPoint = jQuery(this.attachmentPointId).get();
		try {
		var startStuff = this.createSublists(list, 1, 4);  // (,level, pos) will also set maxLevel. Set pos to 4 for start in case small number of subfolders.
		// #bagStart occupies a whole row, so pos=1 is misleading. pos=4 is about the middle of the MAXLIST=7
		} catch (e) {console.error('createSublists failed ',e);}
	    // hardwire the starter
        var $bagstart = jQuery("#bagstart");
	    var startSpan = $bagstart.get();
	    startSpan.items = startStuff.items;
	    startSpan.kids = startStuff.childList;
	    
		$bagstart.click(function () {
			jQuery('#templateItems div').hide(); // hide all templates
			jQuery("#bagNav .active").removeClass("active");
			jQuery("#bagNav div").hide();
			jQuery('#bag [title=templateRoot]').show().parent().show();
			
		});
	    
		function bagSetup() { // enable the basic interaction 
			//jQuery("#bag").show();
			jQuery("#bagNav div").hide(); // hide everything
			jQuery("#templateItems div").hide();
			jQuery('#bag [title=templateRoot]').show().parent().show();
			
			jQuery("#bagNav").click(function (e) {  
			    var t = jQuery(e.target);
			    if (!t.hasClass("folder")) {return;} // don't process spacers
			    t.addClass("active");
			    t.siblings().removeClass("active");
			    var myParentBag = t.parent().parent(); // eg. div#bagS1
			    // this ... fails when a bagS3 is displayed and user clicks a different bagS1. Need to hide any sub-bags 
			    myParentBag.nextAll("div").find("div").hide().end().find(".active").removeClass("active"); // hide any lists in the next level
			    jQuery('#templateItems div').hide(); // hide all templates 
			    var title = t.attr("title"); // use this to identify child folders and items
			    jQuery("#bag").find("div[title='"+title+"']").show().parent("div").show();
			}); 
			
			
		}
		bagSetup();
		this.deferred.resolve();
	},

	// 2014: It would be good to separate the structure from the markup somehow - so that I can store the structure and then quickly render it.
	// turns out there's a Blob data format Binary Large Object
	// should do fine for storing the whole thing.
	// Otherwise even innerhtml will do.

	createSublists: function(parentList, level, pos) {
	    // parentList is a UL, level is the current depth, and pos is the position of the parent-element in its levelm
	    this.maxLevel = (level>this.maxLevel) ? level : this.maxLevel;
	    // WHY not simply generate this structure on the server?  Because breadth-first traversal is HARD.

	    
	    // I seem to remember that the original nested list format isn't any good for constructing the Bureau, as it is too
	    // hard to generate the layout with CSS.
	    
	    // the other complex part of this system is that the nested "drawers" are automaticaly moved to line up
	    // underneath their parent (if there are less than the number of "drawers").
	    
	    // There's a DIV for every folder in the template hierarchy - it only contains the templates - no subfolders
	    // There's a DIV for every LEVEL of the template-hierarchy which doesn't make sense. 
	    
	    // In this version, there's a div#bagSx for each level of drawers 
	    /*
	     * important to keep track of the structure and the reason for it. 
	     * first, there are as many layers of drawers as there is depth to the template-collection hierarchy.
	     * The original design provided a fixed height for the whole thing  (possibly 6 * row-height) 
	     * So when displaying level 0 there would be the following set of drawers (div#bagS1) and then 
	     * room for 4 rows of Templates. 
	     * Clicking on a drawer in #bagS1 reveals #bagS2 underneath, leaving only three rows in which to display
	     * the templates within the selected drawer of #bagS1.
	     * Finally, if you get down to bagS4, there will be only 1 row for templates. 
	     * This deliberately pressures the person managing the templates to put most of them "within easy reach"
	     * near the top of the hierarchy, while the width restriction on drawers (originally 7) is supposed to match
	     * the standard number of things we can remember at one time - and restricts the Bureau from being stretched too wide.
	     * So the resultant tree should be not too wide and have most of its content within the top 2 levels.
	     */
	    
	    // create a div containing the LIs that  are sublists
	    // create another div containing the LIs that are items
	    // for each of the sublist LIs, call this function, passing the level and the UL
	    // this will return an object of the two divs - the div will be added to the subselect's onclick function
	    var bagId = this.BAGPREFIX+level; // eg bagS1
	    var bag = jQuery("#" + bagId);
	    if (bag.length === 0) {
	    	bag = jQuery("<div/>").attr("id",bagId);
	    	jQuery("#bagNav").append(bag);
	    }

	    var parentPath = jQuery(parentList).attr("path");
	    parentPath = (parentPath) ? parentPath : "templateRoot";
	    var sublist = jQuery("<div/>").addClass("sublist"+level).attr("title",parentPath);
	    
	    var items = jQuery("<div/>").attr("title",parentPath);

	    var subsNodeList = jQuery(parentList).children("ul").children("li.sublist");
	    var itemsNodeList = jQuery(parentList).children("ul").children("li.item");
	    var subListItemCount = subsNodeList.length;
	    

	    var postSpacerCount = 0;
	    var preSpacerCount = 0;
	    // lean to the left
	    if ((subListItemCount < this.MAXLIST) && (subListItemCount > 0)) {
	    	var maxPadding = this.MAXLIST - subListItemCount;
	    	// pos is the position of the parent element in its list
	    	
	        var rationalpos = (pos <= this.MAXLIST) ? pos : this.MAXLIST;  // pos might be greater than maxlist
	        preSpacerCount = ( (2 * rationalpos) - 1 - subListItemCount )/2; // kinda divide the sublist in half 
	        preSpacerCount = Math.floor(preSpacerCount);
	        preSpacerCount = (preSpacerCount > 0) ? preSpacerCount : 0;
	        preSpacerCount = (preSpacerCount > maxPadding) ? maxPadding : preSpacerCount; // why would this happen?

	        postSpacerCount = maxPadding - preSpacerCount;
	        for (var i = 0; i< preSpacerCount; i++) {
	        	jQuery("<span class='spacer'/>").appendTo(sublist);
	        }
	    }

	    for (var i = 0, n = subListItemCount; i < n; i++) {	
	        var $li = jQuery(subsNodeList[i]);
	        var cell = jQuery("<span/>").attr("title",$li.attr("path")).addClass("folder").text($li.children("span").text());
	        var ul = $li.children("ul");
	        if (ul.length === 1) {
	        	var subStuff = this.createSublists($li, level + 1, i + 1 + preSpacerCount); //  returns {childList: , items : }
	            cell.data({"kids": subStuff.childList,"items": subStuff.items});
	        }
	        cell.appendTo(sublist);
	    }
	     
	    jQuery.each(itemsNodeList, function (k,v) {
	    	var $li = jQuery(v);
	    	jQuery("<span/>").text($li.text()).attr("title",$li.attr("title")).addClass($li.attr("fileType")).appendTo(items);
	    });

        for (var i = 0; i< postSpacerCount; i++) {
        	jQuery("<span class='spacer'/>").appendTo(sublist);
        }
	    bag.append(sublist);
	    jQuery("#templateItems").append(items);
	    return {childList: sublist, items: items};
	},
	
	reveal : function(template) {
		// get the templateItems div
		// TODO - this doesn't show the templates. Why not?
		if (template && template.contains('/templates')) {
			jQuery("#templateItems .active").removeClass("active");
			jQuery("#templateItems div").hide();
			jQuery("#bagNav div").hide();
			jQuery('#bagNav [title=templateRoot]').show().parent().show(); // because otherwise they will remain hidden

			// to show the appropriate bagNav, use the template path - work up through the path, chopping off the ends
			var pathParts = template.split("/");
			while (pathParts.pop() !== "templates") {
				if (!pathParts) break;
			    var p = pathParts.join("/");
			    jQuery("#bag span[title='" + p + "']").addClass('active').parent().show().parent().show();
			}
			jQuery("#templateItems").find('span[title="' + template + '"]').click().parent().show();
		} else {console.warn('bad template path',template);}
	},
	
	filter : function (doctype) {
		jQuery("#templateItems").find("span")
			.addClass("irrelevant").removeClass("active").end()
			.find("." + doctype)
			.removeClass("irrelevant");
	},

	findFirst : function (doctype) {
		// find the first span having class doctype, call reveal for its template, then show it.
		var f = jQuery("#templateItems").find('span.' + doctype).first();
		this.reveal(f.attr('title'));
	}
};
