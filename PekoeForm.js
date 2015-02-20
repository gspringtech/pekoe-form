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
gs.Pekoe.oEvaluator = new XPathEvaluator(); // not sure about this.

// Evaluate an XPath expression aExpression against a given DOM node
// or Document object (aNode), returning the results as an array
// thanks wanderingstan at morethanwarm dot mail dot com for the
// initial work.
/*
Firefox is throwing warnings when evaluating /ph-links/@for
getAttributeNodeNS. The error is not in Pekoe - it's Firefox
 https://bugzilla.mozilla.org/show_bug.cgi?id=674437

 */
gs.Pekoe.evaluateXPath = function (aNode, aExpr) {
    var xpe = aNode.ownerDocument || aNode;
    var nsResolver = xpe.createNSResolver(xpe.documentElement);
//    Consider using this if the warnings don't go away. The problem is in Firefox.
//    var get = attrOrNodeGetter(aExpr)
    var result = xpe.evaluate(aExpr, aNode, nsResolver, 0, null);
    var found = [];
    var res;
    while (res = result.iterateNext()){
        // found.push(get(res));
        found.push(res);
    }
    return found;
}

// this is a possible solution to the Attribute problem above: curry a getter

var attrOrNodeGetter = function(aExpr) {
    if (aExpr.contains("@")) {
        return function (node) { return node;}
    } else {
        return function (node) { return node[attr];}
    }
}

// Merger Constructor.   2011-02-12 It doesn't look like a real constructor
if (!gs.Pekoe.Form) gs.Pekoe.Form = function (options) {
	"use strict"; // EC5 Directive.
//	console.log("constructor function gs.Pekoe.Form at",options.element); 
	this.options = options;
	this.currentClient = options.file.getPath(); // currentJob. A string 
//	this.job = options.file.doc;
	this.formLocation = options.element;
	this.xTree = null;  // this is the tree. It's a CLONE of the transactionTree
//	this.templateContentXML = null; // the OO Content.xml of the current template. IS THIS NEEDED here?
	this.schema = gs.Pekoe.merger.Utility.getSchema(options.file.getDoctype());
//	console.log("Schema in pekoeForm is",this.schema);
	this.containerElement = options.element; 
	this.contentIsUnsaved = false;
};


// 2011-02-11:  I think this module should go not be responsible for loading any files. The required content
// 				should already be available (schema, ph-tree, content document).
//	 			This means that the calling "manager" must take care to load all the functions. 
// 				That should mean that we hit "displayTemplateContent (but change to) display(schema,doc,template)

gs.Pekoe.Form.prototype = {


// Save, Save and Print, Save As New Document, 
// Can't print unless Saved. Can't save unless modified (applies to New as well)

 // this is an Observer for Form.change event. Should be PRIVATE
 dirty :  function() {
//	if (evt.target.name) { // check that the change event applies to a form element.
//     console.log('you say im dirty');
		jQuery(this.containerElement).trigger("dirty");
		this.contentIsUnsaved = true;
        window.dirty = true;
//	}
},

// this is called by the Controller (JobEditMode)
isDirty : function () {
	return this.contentIsUnsaved;
},


// possibly should be PRIVATE
// this method depends on Utility.markForHiding
// get rid of automatically-added fragments
pruneFormTree : function (startNode) {
	// so this works correctly - except that if the original data is not modified after load, it will be lost.
	if (startNode === null) return;
	var next = startNode.nextSibling;
	var p = startNode.parentNode; 
	if (startNode.pekoeEmpty == true ) {
		p.removeChild(startNode);
	} else {
		this.pruneFormTree(startNode.firstChild);
	}
	if (next !== null) {
		this.pruneFormTree(next);
	}
},

// Accessor method - returns job data to external caller (usually Controller - JobEditMode)
// needed because the original data has been modified. 
// Should probably LOSE this.transactionTree (use as a param only) and RETURN the xTree.cloneNode(true)
getData : function () {
	var transactionTree = jQuery.createEmptyDocument();
	var newRoot = transactionTree.importNode(this.xTree.documentElement,true); // I suspect it's the same job. 
	transactionTree.appendChild(newRoot); // raw DOM method
	// find all the empty leaf-nodes
	// find their parent fragments (if any)
	// mark them for hiding 
	// Side Effect: Tree is now dirty. The copy possibly has the observer as well 
	gs.Pekoe.merger.Utility.markForHiding(transactionTree);
	this.pruneFormTree(transactionTree.documentElement);
    // If the document is completely new, this ends up null after pruning. SO will need to return the original tree
	// I think that PRUNING should occur here and that the transactionTree needs to be modified, not the xTree.
	// the xTree remains associated with the current form. 
	// also, the transactionTree should be the one used when printing
	
	this.contentIsUnsaved = false; // the tree was modified above.
    if (transactionTree.documentElement) {return transactionTree} else {return this.xTree;}
},

// the content has been saved (or newly loaded). Update my State. This is a SET method (accessor?)
 setClean : function (){ //contentStillLoaded) { // boolean param
 	// The idea was to allow the user to Print without modifying the Data. Also
 	// this should inform an Observer (in the Controller)
//	if (this.contentIsUnsaved) {
//		//var saveButton = $('save');
//		//saveButton.disabled=true;
//		if (contentStillLoaded) {
//			;
////			var saveAsButton = $('save-as');
////			saveAsButton.disabled=false;
////			delete this.transactionTree; // kill off the original version and
////			this.transactionTree = this.xTree; // replace with new. This allows the form to be changed
////			this.showTxTree(); // Why is this here?
//		}
//	}
	this.contentIsUnsaved = false;
},


// Need to completely remove the previous merge and any possible closures 
// (with the possible exception of the "copyFields" variable which turns out to be a feature.Will it still work?) 
// Called by Controller (JobEditMode)
/*reallyClean : function () {
	// reset buttons
	// delete or null all top-level members
	// remove any document elements or update("")
	this.xTree = null;
	jQuery(this.formLocation).html("");

	this.templateContentXML = null;
	this.mergedTemplateContent = null;
},*/


/*  Aim: to create a form for the fields referenced by the current Template.
    The Template's pekoe-links ( link href="pekoe://txo/property/address" )
    refer to fields in the Schema (field /txo/property/address == fragment name=address)
    and each field has its own form-definition.

    Fieldsets will be constructed for each branch on the way to the leaf:
    fieldset legend = txo
    fieldset legend = property
    fieldset legend = address
    input type = text, name = city etc

    The Job may have no fields  : <txo/>

    So the first step in this process is to create the basic tree structure for each of the
    fields above.

    Then, enhancements and form-input-generators are added to the tree so that each (relevant)
    node has a toForm function. Finally we call txo.toForm() on the root of the tree so that it renders itself.

 */
  
// bad name. This is more about constructing a tree and creating pekoeNodes

    display : function (markers) {
	// 1) create the NEW Tree. (Any fields referenced by the placeholders that 
	//	are not already in the tree will be added)
	// 2) for each of the fields of interest, attach INPUT behaviour info
	// 3) Render the form by recursively walking the tree and calling the toForm method. 
	
	jQuery(this.formLocation).html(""); // clear the current form	
	var that = this; // because of the jQuery loop
	var atLeastOneDefinedField = false;
    // IT'S NOT the list of PH-DEFINITIONS, its just the list of placeholders for THIS template
    // that's all we want here. The only fields that ARE ADDED TO THIS Job are the ones in this template
    // (but that doesn't alter the pre-existing nodes).


    // make a copy of the transactionTree so we can revert if needed (?? is this likely ??)
    // the xTree is the Significant Object
    var newTree = false;
    // This will allow Undo - NYI - OR allow the transactionTree to be pruned before save/print
    that.xTree = jQuery.createEmptyDocument();
    //console.log('documentElement',this.options.file.doc.documentElement);
    var newRoot = that.xTree.importNode(this.options.file.doc.documentElement,true); // I suspect it's the same job.
    that.xTree.appendChild(newRoot); // raw DOM method

    gs.thedocument = that.xTree; // for debugging purposes
//		this is where we process the placeholders in the phtree
    var links = jQuery(markers).find("link");
    // only want to process unique fields - but must check that each ph-link marker HAS a field

    var fields = {};
    // Once again. First process the Template Links to find the Fields needed for this Template. Collect the "definition" of these fields from the Schema
    jQuery.each(links,function(key,item) {

        var $item = jQuery(item); // a <link>
        var isDefault = $item.parent().is("default-links"); // beautiful
        var fieldpath = $item.attr("path"); // ...  to a field like /txo/property/address or /schema/field-or-fragmentRef
        var field = fieldpath.split('?')[0]; // strip off params ?output=address-on-one-line
        field = (field.indexOf('[') !== 0) ? field = field.replace(/\[[^[]*\]/g, '') : field; // strip off any filter expressions like [last()]
        if (field === "") { // this should never happen. The Link IS the path
            console.warn("Can't process link without path",key,item);
            return;
        }
        if (field.indexOf('//') === 0 || field.indexOf('/') !== 0) {
            // it is possible that a link will be relative - e.g. //client/referrer.
            // in this case, it can't be used as a field reference. It is only for output.
            console.log('ignoring descendant-axis path or missing context',fieldpath);
            return;
        }
        var fieldDefinition = that.schema.getFieldDefByPath(field); // will automatically return a basic input if no schema definition exists
        if (!fieldDefinition) {
            console.warn("No field definition for",field);
            return;
        }
        // capture the node definition for later use. // but WHY add it to another list? we already have a list

        fields[field] = fieldDefinition; // will be defined once for unique field
        fields[field].isDefault = isDefault;
        var $el = $(fieldDefinition);
        //console.log('fieldDevi',fieldDefinition);
        var fieldChoice = $el.find('input').attr('type') === 'field-choice';
        if (fieldChoice) {
            var optionalFields = $el.find('list').text().trim().split('\n');
            var pathbase = field.split('/');
            pathbase.pop();
            pathbase = pathbase.join('/');
            //console.log('pathbase is',pathbase);
            for (var i=0; i< optionalFields.length; i++) {
                var fieldOption = pathbase + '/' + optionalFields[i];
                var fd = that.schema.getFieldDefByPath(fieldOption);
                //console.log('got fd',fd);
                if (fd) {
                    fields[fieldOption] = fd;
                    fields[fieldOption].optional = true;
                }

            }
        }


        //console.log(path, "possible elements", possibleElements);
        // the fields are then path.split('/').pop() + possibleElements[i].join('/');
        // if the fieldDefinition shows this to be a field-choice element, then
        // add the optional fields, but mark them as optional.
        // later, these fields can be handled IFF they are already present.
    });

        // Somewhere here I need to add paths for top-level choice options.
        // These need to be marked so that I can later say "only render this if it exists in the tree"
        /*

         // Maybe this is where I check for the field-choice elements.
         var fieldChoice = $el.find('input').attr('type') === 'field-choice';
         var possibleElements = fieldChoice? $el.find('list').text().trim().split('\n') : []; // [field, fragment-ref]

         console.log(path, "possible elements", possibleElements);
         // the fields are then path.split('/').pop() + possibleElements[i].join('/');

         // now that I know the Possible elements, what do I do? Look for them?
         // If I add them as paths, they'll be rendered as though they were in the template list. I think.
         // YES. if the fields are added here, they'll be automatically added to the Job - which is what I'm trying to avoid.
         // Okay - fine. Not the right place maybe to deal with this ?
         // Also, what about sub-fields like input/source-option (list,lookup,calculation)

         // and remember, that was another option for creating the choice - use a sequence of items in the path


         */

    for (var path in fields) { // key is the field path
        atLeastOneDefinedField = true;
        var fieldDefinition = fields[path]; // that.schema.getFieldDefByPath(path); // all the extra info
        var isAdHoc = jQuery(fieldDefinition).attr("ad-hoc") === true; //NOTE: these are ad-hoc, non-schema fields.

        var selectStmt = path;
        // this is all about CREATING and PATCHING-UP the tree

        // there is a special case: if the 'field' is of type 'field-choice' then I need to see if any of its element options have been selected.
        // this is, of course, another nasty hack.


        // Fix the path for jQuery (change XPath into CSS-style paths (" > "). Remove @ref.
        // remove leading / replace @ then replace remaining / with " > ".
        var sourcePath = path.replace(/^\//,"").replace(/\/@.*/,"").replace(/\//g," > ");

        /*

         * USE these for TESTING _________________________________
         * jQuery(gs.schemas["txo"].fragmentsTree).find("person");
         * jQuery(gs.thedocument).find("txo > property > address")
         * _______________________________________________________

         */

        var $el = jQuery(fieldDefinition);
        var isFragmentRef = fieldDefinition.nodeName === 'fragment-ref';
        var fragment;
        if (isFragmentRef) {
            // **** looking for the leaf of this path under the root of the fragmentsTree ****
            fragment = this.schema.getTemplateFragment("/fragments/" + selectStmt);
            if (fragment === "") {
                console.warn("The fragment hasn't been defined for", selectStmt);
                return;
            }
        }



        var countExistingFields = 0;
        var isAttribute = selectStmt.indexOf("@") > -1;
        var attrName = selectStmt.replace(/^.*\@/,"");
        // does this path lead to existing data in the transactionTree? "count" existing nodes:
        if (!isAttribute){ // simply find the leaf
            countExistingFields = jQuery(that.xTree).find(sourcePath).length;
        } else { // ATTRIBUTE: find the leaf and then check for its attribute
             // get rid of everything up to the @ - leaving the attribute NAME
            jQuery(that.xTree).find(sourcePath).each(function () {
                // we found the parentElement of this attribute.
                if (jQuery(this).attr(attrName)) {
                    // the attribute exists
                } else {
                    // the attribute doesn't exist - so add it.
                    jQuery(this).attr(attrName,"");
                }
                countExistingFields++;
            });

        }
// 		 	console.log("Looking for field using sourcepath:",sourcePath); // this is the field provided by the ph-links file. (the placeholder-to-field link)

        if (countExistingFields === 0 && !fieldDefinition.optional) { // this happens when the field is not found in the document.
            // This situation occurs when the user chooses a template with MORE DETAIL.
            // Or a template with a non-schema field. (ad-hoc). ad-hoc fields will be "first".
            var child;
            var pathParts = path.split("/");
            pathParts.shift(); // get rid of first empty element
            if (isFragmentRef) {
                child = that.xTree.importNode(fragment,true); // A: Add the full fragment to this document
                selectStmt = selectStmt.split("/");		// B: . Modify the path so that it points to the attachment-point.
                selectStmt.pop();
                selectStmt = selectStmt.join("/");
            } else if (isAttribute) {
                pathParts.pop(); // get rid of the attr name
//					var cname = pathParts[pathParts.length -1];
                child = this.xTree.createElement(pathParts[pathParts.length -1]);
//					child = jQuery("<"+pathParts[pathParts.length -1] + "/>",that.xTree).get(0);// jQuery can't create XML (eg student-fee). 
                jQuery(child).attr(attrName,"");
            } else {
                var cname = pathParts[pathParts.length -1];
                child = this.xTree.createElement(cname);
                //child = jQuery("<"+ cname + "/>",that.xTree).get(0);// jQuery can't create XML.
                if (!child) { console.warn("Child is null for",cname, "isFragReg:",isFragmentRef ); return;}
            }

			if (!newTree) {child.nw = true;} // in an existing tree: this field is new
            child.defaultField = fields[path].isDefault; // jQuery can't get the attribute node. bugger.
            child.adHoc = isAdHoc;
            // SCHEMA ORDER IS BEST. This can be found using the sampleTree
            gs.Pekoe.merger.Utility.addMeInTheRightPartOfTheTree(that.xTree, this.schema, pathParts, child);
        } else { // if the existing field is a fragmentRef, make sure it has all the appropriate parts
            jQuery(that.xTree).find(sourcePath).each(function () {
                if (isFragmentRef) {
                    if (jQuery(this).attr("deleted")) { // don't do anything
                    } else {
                        gs.Pekoe.mirrorNodes(fragment,this);  // make sure that the fragment has all its parts
                    }
                }
                this.defaultField = fields[path].isDefault;
                this.adHoc = isAdHoc;
            });
        }
        // have enhanced the tree - creating new leaves and fragments and patching existing ones.
    } //  end of for() loop

    var $div = jQuery(this.formLocation);
    // enhance each Node identified by the current template's list of placeholders
    // THE FULL TREE HAS BEEN CONSTRUCTED so now...
    if (!atLeastOneDefinedField) {
        alert("There are no field definitions for this template. Please use the Field Editor.");
        return;
    }
    try {
        gs.Pekoe.merger.Utility.attachPlaceholderInfo(that.schema, that.xTree, fields);
        gs.Pekoe.merger.Utility.markForHiding(that.xTree);
    } catch (attp) {console.error("attp",attp);}


    // remainder is the form rendering and then the mechanics of attaching to the html document.

    // -------------------------- this is it ... -------------------------------------
    var mform = jQuery('<form class="tx-controls" action="" autocomplete="off" ></form>');
    try {
        var fm = gs.Pekoe.baseForm.call(that.xTree.documentElement); // Hehe, how easy is that!
        mform.append(fm);
    } catch (e) {console.error("Error rendering the form:",e); return;}
    $div.append(mform);
    // -------------------------------------------------------------------------------
    gs.Pekoe.merger.Utility.applyEnhancements(mform);

    // TODO fix this - Mutation Events are obsolete. Use Mutation Observer instead
    // https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver

    /*
     https://developer.mozilla.org/en/docs/Web/API/MutationObserver

     var observer = new MutationObserver(function (mrList){
     mrList.forEach(function(mutation) {
     console.log(mutation.type, mutation.target);
     });
     });

     var config = { attributes: true, childList: true, characterData: true, subtree: true};


     var sb = jQuery(gs.thedocument).find('school-booking').get(0);
     observer.observe(sb,config);

     Above, will return "childList <web-form>" when a change is made to the text of the /school-booking/web-form

     FROM MutationObserver page:
     childList	            Set to true if additions and removals of the target node's child elements (including text nodes) are to be observed.
     attributes	            Set to true if mutations to target's attributes are to be observed.
     characterData	        Set to true if mutations to target's data are to be observed.
     subtree	            Set to true if mutations to not just target, but also target's descendants are to be observed.
     attributeOldValue	    Set to true if attributes is set to true and target's attribute value before the mutation needs to be recorded.
     characterDataOldValue	Set to true if characterData is set to true and target's data before the mutation needs to be recorded.
     attributeFilter	    Set to an array of attribute local names (without namespace) if not all attribute mutations need to be observed.

     */

    var observer = new MutationObserver(function (mutations){
        that.dirty(); // activate the Save button etc.
        mutations.forEach(function (mutation){
            // regardless of the type, we want the element.
            var modElement = mutation.target;
            modElement.pekoeEmpty = false;
            jQuery(modElement).parents().each(function (e) {e.pekoeEmpty = false;})
        });
    });
    var config = {attributes: true, childList: true, subtree: true};
    observer.observe(that.xTree,config);

    // INITIAL STATE is clean
    this.setClean(true);

}



}; // ---------------------- END OF Pekoe.Form.PROTOTYPE ------------------------------------

/* 
 * This method is supposed to take a fragmentRef node (the "source")
 * and compare its structure to the prototype in the "fragments". Missing fields are added to this structure.
 * NOTE: this version has been pulled into Pekoe 4
 */
gs.Pekoe.mirrorNodes = function (fragment, source) {// would be better named (source, target)
	// import a complete copy of the fragment
	var nn = source.ownerDocument.importNode(fragment,true);
	// for every child node, see if it exists in the source. If so, move it to the nn 
	// must copy attributes here...
	if (source.attributes && source.attributes.length > 0) {
		// The attributes of an xTree node can have field-info ,
		for (var i = 0; i < source.attributes.length; i++) {
			nn.setAttribute(source.attributes[i].name, source.attributes[i].value);
		}
	}
	
	var mark = jQuery(source).first(); // will only be here if there ARE children
	jQuery(nn).children().each(function () {
		var matching = jQuery(source).find(this.nodeName);
		if (matching.length > 0) { 
		    mark = matching.last(); // found some of those, so save the position for ...
		} else { 
		    if (!mark.nodeName) { // must be at the beginning
			mark = jQuery(this).prependTo(source);
		    } else {
			mark = jQuery(this).insertAfter(mark); 
		    }
		}
	});
};

gs.Pekoe.nodeId = 0; // Very dodgy place to define this global counter.

//gs.Pekoe.pekoeAttributeForm = function () {
//    // if this node has attributes - which should be form elements, they will be rendered by the ElementMaker.
//    var formEl = document.createDocumentFragment();
//    console.log('calling pekoeAttributeForm on',this);
//    gs.Pekoe.merger.InputMaker(formEl,this,);
//    return formEl;
//};

// TODO - consider moving this into ATTP in Utility.js
gs.Pekoe.pekoeNodeForm = function () {
	// if this node has attributes - which should be form elements, they will be rendered by the ElementMaker.
	var formEl = document.createDocumentFragment();
//    console.log('calling pekoeNodeForm on',this);
	gs.Pekoe.merger.InputMaker(formEl,this);
	return formEl;
};

// for placeholders in the current template, generate a form element. 

/*
    fragmentNodeform Usages - Utility.js (needs refactoring)
    duplicate() - if fragmentRef
    addMe()
    enhanceSubtree()
    attachPlaceholderInfo
    -- there's a surprising amount of re-use and repetition going on.
    -- Highly unlikely that the pekoeNode is an Attribute (so lookup should be fine)
 */
gs.Pekoe.fragmentNodeForm = function () {
	var fragmentNode = this;
	if (fragmentNode.getAttribute("deleted")) return null; // TODO is this used?
	var formEl = jQuery("<fieldset />"); // this will contain the fields
	//if (jQuery(fragmentNode.ph).attr('optional') === 'yes') {
	//	console.log("OPTIONAL field", formEl);
	//	jQuery('<select name="frag"><option>-</option><option>Frag1</option><option>Frag2</option></select>').appendTo(formEl);
	//	return formEl[0];
	//}
    var options = jQuery(fragmentNode.ph).find("options").text();
	var isRepeating = options.indexOf("repeating") !== -1; //jQuery(fragmentNode.ph).find("options:contains('repeating')").length > 0;
    if (isRepeating) formEl.addClass('repeating');
	var hideEmpty = options.indexOf("initially-closed") !== -1; //jQuery(fragmentNode.ph).find("options:contains('initially-closed')").length > 0;
    var fieldChoice = options.indexOf("field-choice") !== -1;
    var pathToHere = gs.Utility.getElementTreeXPath(fragmentNode);
	var re = /\[[\d]+\]$/; // match the position filter (e.g. "[2]") at the end of the path.  
	var t = (isRepeating) ? pathToHere : pathToHere.replace(re,""); // remove it if this is a non-repeating field (for the title attribute)
	var fieldIndex = re.exec(t) || ""; // get that position filter and use it after the nodename as the text of the legend...
	
	formEl.attr("title",t);
	
	formEl[0].pekoeNode = fragmentNode; // !!!!

	if (fragmentNode.defaultField) {formEl.addClass("default-field");}
	
	// Hide everything if the fragment is unused. 
	if (fragmentNode.pekoeEmpty === true && hideEmpty) {
		// Hide elements if they are empty and marked as "initially-closed"
		formEl.addClass("hidden-fieldset-children"); // Also need "show-first-field-only" for fragment elision
	}
	// finally, want this to be used to change the background-color 
	
	var legend = jQuery("<legend />");
	var fsName = jQuery("<span class='fragmentName'/>")
		.text(this.nodeName + fieldIndex)
		.click( 	// Hide the contents of this Fragment. As above, hide all if empty, otherwise show only first field.
			function (evt) {  
				if (! gs.Pekoe.GlobalCopy.copyToHere(legend[0])) {	
					var $this = jQuery(this);
					var $parentFS =  $this.parents("fieldset").first();
					//var elisionType = "hidden-fieldset-children";
					//if (thisPekoeNode.pekoeEmpty === undefined || thisPekoeNode.pekoeEmpty === false) { elisionType = "show-first-field-only"; }
					// Crap. This doesn't work for .siblings. Would have to iterate and test.
					if (evt.altKey) {
							$parentFS.toggleClass("hidden-fieldset-children");
							$parentFS.siblings("fieldset").toggleClass("hidden-fieldset-children");
					} else {
						$parentFS.toggleClass("hidden-fieldset-children");
					}
				}
		})
		.appendTo(legend);
    // TODO move this to some kind of Angular Directive.
	if (isRepeating) {
		// addMe
		jQuery("<span class='btn'><img src='css/graphics/icons/add.png' class='tool-icon' /></span>")
			.attr("title", "Add another '" + fragmentNode.nodeName +"'")
			.click(function () {gs.Pekoe.merger.Utility.addMe(formEl[0],false);})
			.appendTo(legend);
		// deleteMe
		jQuery("<span class='btn'><img src='css/graphics/icons/delete.png' class='tool-icon' /></span>")
			.attr("title", "Delete this '" + fragmentNode.nodeName +"'")
			.click(function () {gs.Pekoe.merger.Utility.deleteMe(formEl[0]);})
			.appendTo(legend);
		// copy Me
		jQuery("<span class='btn'><img src='css/graphics/icons/page_copy.png' class='tool-icon' /></span>")
			.attr("title", "Add a Copy of '" + fragmentNode.nodeName +"'")
			.click(function () {gs.Pekoe.merger.Utility.addMe(formEl[0],true);})
			.appendTo(legend);
		// copy my Values
		jQuery("<span class='btn'><img src='css/graphics/icons/pencil_add.png' class='tool-icon' /></span>")
			.attr("title", "Copy values from this '" + fragmentNode.nodeName +"'")
			.click(function () {gs.Pekoe.GlobalCopy.copyMe(legend[0]);})
			.appendTo(legend);
        jQuery("<i class='fa fa-sort pull-right' title='this item can be re-ordered among its peers.'></i>").appendTo(legend);
    } else if (fieldChoice) {
        jQuery("<span class='btn'><img src='css/graphics/icons/delete.png' class='tool-icon' /></span>")
            .attr("title", "Delete this '" + fragmentNode.nodeName +"'")
            .click(function () {gs.Pekoe.merger.Utility.deleteMe(formEl[0]);})
            .appendTo(legend);
    }

	// Does this fragment have a lookup script?
	// Maybe it has more than one? Is that useful? 
	// if so, then merger-utils.apply enhancements will be used
	var $lookup = (jQuery(fragmentNode.ph).find("lookup").length > 0) ? jQuery(fragmentNode.ph).find("lookup") : null;
	if ($lookup !== null) {
        //console.log('got lookup',fragmentNode);
		formEl.addClass("fragment-lookup");
	}
//		var $help = jQuery(this.ph).find("input help");
		
	
	legend.appendTo(formEl);
	fsName.mouseover(function (evt) { legend.parent().addClass("hovered");  });
	fsName.mouseover(function (evt) { legend.parent().removeClass("hovered");  });

    // because fragmentNode is a dom.Element, this.attributes exists and is an Array of Attr (not a NodeList)

    for (var i = 0; i< fragmentNode.attributes.length; i++  ) {
        var a = fragmentNode.attributes.item(i);
        if ((a.ph) && (a.ph !== null)) {
            // The majority of attributes are processed through here. What they need is their parent
//            console.log('FRAGMENT ATTRIBUTE calling InputMaker for',a.name, 'on',fragmentNode.nodeName);
            gs.Pekoe.merger.InputMaker(formEl[0],a,fragmentNode);
        }
    }
	
//	var kids = $A(this.childNodes); prototype
	jQuery(fragmentNode).children().each(function (){
		var cn = this;
//		console.log("Fragment node form processing child",cn.nodeName);
		var cnfEl = null;
		if (cn.toForm){
			cnfEl = cn.toForm() ;
		} else {
			cnfEl = gs.Pekoe.baseForm.call(cn);
		}
	   	if (cnfEl != null) formEl.append(cnfEl);
	});
	return formEl[0];
};


gs.Pekoe.baseForm = function () {
	// It's possible for leaf nodes to appear here - if they are not relevant to this form
	
	// could this be used automatically? i.e. could it include the test for fragment or pekoeNode?
	// it would be better to check that this is being called on the current txo, but that's hard.
	if (this.nodeType == Node.TEXT_NODE) { return; }
//	console.log("calling base toForm on",this.nodeName);
	if ((this.ownerDocument == null) || (this.ownerDocument == document)) return; // probably should flag an error
	if (this.ph) {
		// This should be an error
		//if (jQuery(this.ph).attr("fieldType") == 'fragmentRef') {
        if (this.ph.nodeName === 'fragment-ref') {
            console.error("Fragment", this.nodeName, "wasn't rendered using fragmentNodeForm");
            //} else if (jQuery(this.ph).attr("fieldType") == "simple") {
        } else if (this.ph.nodeName === 'field') {
			console.error("PekoeNode",this.nodeName, "wasn't rendered using pekoeNodeForm");
		}
	}
	// the assumption is that this node is a branch and doesn't have any field info
	// but its children might be enhanced. an example is /txo/jobowner:
	// jobowner/name, jobowner/email are separate fields which will be rendered if they've been marked with a ph
	//   
	var fs = null;
	var frag = document.createDocumentFragment();
	if (this.attributes && this.attributes.length) {
		for (var i = 0; i< this.attributes.length; i++  ) {
			var cn = this.attributes.item(i);
			var cnfEl = null; 
			if (cn.toForm) {
				cnfEl = cn.toForm() ;
			} else {
				cnfEl = gs.Pekoe.baseForm.call(cn);
			}
	   		if (cnfEl != null){
	   			frag.appendChild(cnfEl);
	   		}
		}
	}

	jQuery(this).children().each(function () {
		var cn = this;
		var cnfEl = null; 
		if (cn.toForm) {
			cnfEl = cn.toForm() ;
//			console.log("expect to get field or fragment branch for",cn.nodeName, "got",cnfEl);
		} else {
			
			cnfEl = gs.Pekoe.baseForm.call(cn);
//			console.log("expect to get another simple branch for",cn.nodeName, "got",cnfEl);
		}
   		if (cnfEl != null) {
   			frag.appendChild(cnfEl);
   		}
	});

	if (frag.hasChildNodes()) { // then create a fieldset and display it in the form
		try{
		fs =  document.createElement("fieldset");
		fs.pekoeNode = this;
//        console.log('baseform frag.childeNodes',this);
		var pathToHere = gs.Utility.getElementTreeXPath(this);
		fs.setAttribute("title",pathToHere);
		jQuery("<legend></legend>")
			.text(this.nodeName)
			.click(function() {
                jQuery(this.parentNode).toggleClass("hidden-fieldset-children");
 				})
			.hover(
				function (){jQuery(this).addClass("hovered");},
				function (){jQuery(this).removeClass("hovered");})
			.appendTo(fs);
		fs.appendChild(frag);
		} catch (e) {console.warn("baseForm fieldset error",e);}
//		console.log("finished creating fieldset in base toForm");
	} 
	return fs; 
};

/*
 * Why not do this like a Tree drag and drop? Only problem is that I want to match CHILDREN not ROOT/BRANCH.
 * How would that work?
 * 
 * 
 */
gs.Pekoe.BranchCopy = {
	copyFrom: null,
	copyMe : function (legend) {
		this.copyFrom = legend;// copyFrom fs
		document.body.style.cursor = "copy";
		jQuery.statusMessage("Click on the title of the fragment you're copying to, or back on the source to cancel.");
		this.copyFrom.className = "copyFrom";
		return false;
	},
	copyToHere : function (legend) { // c
		if (this.copyFrom == null) {
			return false;
		}
		// copy all the child nodes of the copyFrom INTO the target pekoeNode
		// BUT what if the target already has some nodes - how do I replace them? Is 
		// this another "mirror-nodes"?
		var sourceP = this.copyFrom.parent()[0].pekoeNode;
		var targetP = legend.parent()[0].pekoeNode;
//		console.log("sourceP",sourceP, "and targetP",targetP, "and legend.parent",legend.parent()[0]);
		
//		nn.ph = pkn.ph;
//		nn.toForm = pkn.toForm; // I guess its not gone yet
////									mirrorNodes(e,pkn);
//		enhanceSubtree(schema, nn, nodeToFind); // Bloody BRILLIANT
		
		gs.Pekoe.mirrorNodes(sourceP,targetP);
		legend.parent()[0].toForm(); // do I need to remove stuff first?

	}
	
	
};


gs.Pekoe.GlobalCopy = {
	
	// But what I originally wanted was a way to copy "similar" things. For example, a vendor could be copied to a purchaser - getting the person and address
	// but not getting the irrelevant fields. That sounds like a lot more work. 
	// Mostly, this will be for copying from one job to another.

    // Can I simply clone the underlying data subtree and then graft it on at the destination?
	// 
	copyFrom : null,
	copyMe : function (legend) {  // note and Mark the Source, change the cursor
		this.copyFrom = legend.parentNode;// copyFrom fs
		document.body.style.cursor = "copy";
		jQuery.statusMessage("Click on the title of the fragment you're copying to.");
		this.copyFrom.className = "copyFrom";
		return false;
	},

	copyToHere : function (leg){ 
		if (this.copyFrom == null) {
			return false;
		}
	
		
		var copyToFS = leg.parentNode; // the fs 
	    // TODO WHY NOT copy the xml subtree?.
		// currently, this is trying to copy the field values. It doesn't work correctly.
        // instead, why not copy the subtree and then replicate?
        // also, this is not going to be able to copy to another form. (Pekoe v2 could do that because the forms were all in the same Document)
		if (this.copyFrom != copyToFS) {

			// TODO - rewrite this to copy the XML subtree and then re-render at the destination (this is a Clone operation)
            // TODO - assess whether this will work. How is Replicate different?
            /*
                Consider:
                Only a Fieldset can be copied -> a Subtree
                I WANT to copy from like to like - so
                vendor -> purchaser means copying things like Person and Client - but there are a bunch of things that shouldn't be copied.
                Really, this is probably not as useful as I might think.
             */
			var $sources = jQuery("input", this.copyFrom);
//			var sources = $A(this.copyFrom.getElementsByTagName('input')); Prototype.js
			var $selectSources = jQuery('select',this.copyFrom);		
//			var selectSources = $A(this.copyFrom.getElementsByTagName('select')); // what about textarea?
			
			// get the target fields
			var $copies = jQuery("input",copyToFS);
//			var copies = $A(copyToFS.getElementsByTagName('input'));
			var $selectCopies = jQuery("select",copyToFS);
//			var selectCopies = $A(copyToFS.getElementsByTagName('select')); // what about textarea?
			

			var sourceDict = {};
		
			// collect the source values into a dict of name:value
			$sources.each(function() {
//				collect the value of each input - or, in the case of radio buttons or checkboxes, 
// 				only collect the value of the selected one.  
//				if it's a radio button, don't add it unless it's "checked"
				if ((this.type != "radio") || (this.checked)){
					sourceDict[this.name.split("/").pop().split("-").shift()] = this.value;	
				}
			});
			
			
			// Doesn't handle select/option. 
			$copies.each(function() { 
				var targetName = this.name.split("/").pop().split("-").shift();
				var oldValue = sourceDict[targetName];
//				console.log('want to set',targetName,oldValue);
				if (oldValue) {
					if ((this.type == "radio") || (this.type == "checkbox")) {
						this.checked = (this.value == oldValue);
					} else {
						this.value = oldValue;
					}
					// the link to the xTree is dependent on the "change" event which won't be sent, so ...
					this.pekoeNode.textContent = oldValue;
				}
			});
			$selectSources.each(function() {
//				console.log('inp.type',inp.name); // 
				sourceDict[this.name.split("/").pop().split("-").shift()] = this.selectedIndex;	
			});
			$selectCopies.each(function() {
				var targetName = this.name.split("/").pop().split("-").shift();
				var oldValue = sourceDict[targetName];
				
				if (oldValue) {
//					console.log('inp.name',inp.name,'targetName',targetName,'to index',oldValue, 'with value',inp.options[oldValue].value);				
					this.selectedIndex = oldValue;
//					inp.pekoeNode.textContent = oldValue;
					this.pekoeNode.textContent = this.options[oldValue].value;
				}
			});
		}
		this.copyFrom.className = "";
		this.copyFrom = null;
		document.body.style.cursor = "auto";
		return true;
	}
};

gs.Pekoe.Form.defaultInputSize = 20;
