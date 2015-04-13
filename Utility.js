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

if (!gs) { gs = {}; }
if (!gs.Pekoe) { gs.Pekoe = {}; }
if (!gs.Pekoe.merger) {gs.Pekoe.merger = {}; }
// a singleton - it is created once and the methods associated with mergerUtils are publicly accessible.
// It's a bit of a mixed bag. It would be good to remove the Schema stuff.
gs.Pekoe.merger.Utility = function () {
	
	jQuery.createEmptyDocument = function () { // from Flanagan's Javascript: The Definitive Guide
		if (document.implementation && document.implementation.createDocument) {
			return document.implementation.createDocument("","",null);
		} else {
			return new ActiveXObject("MSXML2.DOMDocument"); // not that I really expect IE to work.
		}
	};

	jQuery.createXMLDocument = function(string) {
		return (new DOMParser()).parseFromString(string, 'text/xml');
	};


	var schemas = {}; // a hash to manage all the schemas. Keep it private and provide appropriate accessors
	// these... are no longer needed
//	var schemaIsLoaded = false;
//	var schemaPath = "";
//	var fieldDefsByName = {};
//	var fieldDefsByPath = {};
//	var fragmentsTree = document.implementation.createDocument("","fragments",null);
	
	gs.schemas=schemas; // Might need to keep this as the Merger needs access to the schema. BAD
	// Use a default field when the ph-links calls for a field not in the schema.
	gs.defaultField = jQuery.createXMLDocument("<field><input type='text' size='10' /></field>");
	var makeSchema = function (o) {
		var s = {
			doctype: "", 
			getDoctype : function () { return this.doctype; },
			path: null, 
			fieldDefsByPath : {},
            fragmentLookups : {}, // keep a list of the fragments by @name e.g. "person" or "jobowner"
			getFieldDefByPath : function (f) { // will provide a default field if there's not one there.
				// if the path goes INSIDE a fragment, we should try to find its schema there. 
				if (this.fieldDefsByPath[f]) { 
					return this.fieldDefsByPath[f]; 
				} else {
					var pathParts = f.split("/"); //",schema,field,input,list"
//					pathParts.splice(0,2); // changes original array
					var last_two_steps = pathParts.slice(-2); // doesn't change original array
					// this doesn't allow a fragment to be a single step.
					var fragmentName = last_two_steps.join("/");

 					
					if (this.fieldDefsByPath[fragmentName]) { 
						return this.fieldDefsByPath[fragmentName];
					} else if (this.fieldDefsByPath[last_two_steps[1]]) {
						console.log("found single-step field",last_two_steps[1]);
						return this.fieldDefsByPath[last_two_steps[1]];
					}
					else{
						console.warn("ad-hoc field:",fragmentName);
						return jQuery(gs.defaultField).attr("path",f).attr("ad-hoc",true).get(0);
					}
				}
			},
			getFragmentDefsByPath : function (f) { 
				return this.fieldDefsByPath[f];
			},
			getTemplateFragment :  getTemplateFragment,
			fragmentsTree:null,
			sampleTree:null
		}; 
		jQuery.extend(s, o); // extend first object, overwriting any initial members if available in second object
		s.fragmentsTree = document.implementation.createDocument("","fragments",null);
		s.sampleTree = document.implementation.createDocument("",s.doctype,null);
		return s;
	};
	
	// I will use schemas["txo"] = makeSchema({path:'/db...', doctype: 'txo'});

	

	var mergerUtils = {};
   
	    // ************************    POST RENDERING, Apply widgets  **************************************************
	    // Enhancements are:
        //  - sortable fieldsets
        //  - JAVASCRIPT enhancements from the schema (marked as .pekoe-enhancement)
        //  - Editable Rich Text

	    // I want a "calculation" that can be triggered on field-change.
	    // It should run every time a field is changed - check all the calculations 
	    // If the input@derivedSrc is a calculation, the value should only be updated if not already set.
	// there's a good example here: http://jsbin.com/ixabo/edit?html,js,output but it's complex

	mergerUtils.applyEnhancements = applyEnhancements;

	// consider the possibility of dynamically adding .sortable to the parent of the click-handle. Then,
	// the selected elements can be made more specific
	function applyEnhancements(mform) {

		/*
		Here's an idea.
		Why not link the option-click "close folds" to ordering. Turn on the dragger
		OR
		make the sorting dependent on the dragger - in which case only the peers of 'this' element can be sorted.


		For some strange reason, an element can be dragged INSIDE another. (e.g. allowing a field to become a child of a field.)
		 */

		jQuery("fieldset").sortable({
			axis:'y',
			items:'.repeating',
			stop: function (e,ui) {
				if (ui.item.is('fieldset')){ // needs a little refactoring...
					var pkn = ui.item.get(0).pekoeNode;
					var nn = pkn.nodeName;
					var preSib = ui.item.prev().get(0);

					var nextSib = ui.item.next().get(0);
					// the nodeName test is preventing me from sorting fragment, field, fragment-ref
					// is there some way to find out what things could be here? I guess not without a proper schema.
					if (pkn && preSib && preSib.pekoeNode) { // && preSib.pekoeNode.nodeName == nn) {
						jQuery(preSib.pekoeNode).after(pkn);
					} else if (pkn && nextSib && nextSib.pekoeNode) { // && nextSib.pekoeNode.nodeName == nn) {
						jQuery(nextSib.pekoeNode).before(pkn);
					} else {
						jQuery(this).sortable('cancel');
						jQuery(this).effect('shake');
						console.warn("Couldn't move pkn",pkn);
					}
				} else if (ui.item.is('span')) {
					var pkn = ui.item.find('input').get(0).pekoeNode;
					var nn = pkn.nodeName;
					var preSib = ui.item.prev().find('input').get(0);
					var nextSib = ui.item.next().find('input').get(0);
					if (pkn && preSib && preSib.pekoeNode && preSib.pekoeNode.nodeName == nn) {
						jQuery(preSib.pekoeNode).after(pkn);
					} else if (pkn && nextSib && nextSib.pekoeNode && nextSib.pekoeNode.nodeName == nn) {
						jQuery(nextSib.pekoeNode).before(pkn);
					} else {
						jQuery(this).sortable('cancel');
						jQuery(this).effect('shake');
						console.warn("Couldn't move. pkn",pkn);
					}
				}

			}
		});
	//    // Automatic sorting for repeating items.
	//	// first, it is the parent of the sortable items we want.
	//    jQuery("fieldset:has( > .repeating)").each(function(){
	//		var $fs = $(this);
	//		$fs.sortable({
	//		items: '> .repeating',
	//		axis: 'y',
	//		opacity: 0.5,
	//		appendTo: $fs,
	//		handle: 'legend .fa-sort',
	//		beforeStop: function (event, ui) {
    //
	//		},
	//	    stop : function (event, ui) {
	//	    	console.log("ui.item ",ui.item);  //this is the FORM and ui.item is the [fieldset]
	//	    	var pkn = ui.item.get(0).pekoeNode; // the moved item
	//	    	var $prev = ui.item.prev();
	//	    	var elderP = $prev.get(0).pekoeNode; // its new preceding-sib
	//	    	if (elderP && pkn) {
	//	    		jQuery(elderP).after(pkn);  // move it.
	//	    	} else {
	//	    		console.warn("Can't move because one or other of these is null. Prev FS (elderP):",elderP, "and pkn:",pkn);
	//	    		jQuery.statusMessage("Can't move " + ui.item.attr("title") + " after " + $prev.attr("title"));
	//	    	}
	//	    }
	//    });
	//});
		//jQuery('fieldset:has( > .item-repeating)').sortable({
		//	items: '.item-repeating',
		//	axis:'y',
		//	appendTo: 'parent',
		//	opacity: 0.5
		//});

		//jQuery("fieldset:has( > .item-repeating)").each(
		//	function (){
		//		var $fs = $(this);
		//		$fs.sortable({
		//			items: '.item-repeating',
		//			axis:'y',
		//			appendTo:$fs,
		//			opacity: 0.5
		//		});
		//	});

//		jQuery("fieldset", mform).sortable({
//			items: "span.repeating",
//			placeholder: 'sortable-placeholder',
//			opacity: 0.5,
//			appendTo: "parent",
//			// this should be applied according to some rules in the schema.
//			// reorder: none; among peers; among siblings; anywhere. Not sure how to make that work.
//			stop : function (event, ui) {
//				// ui.item is the .repeating element
//				console.log("ui.item ",ui.item);  //this is the FORM and ui.item is the [fieldset]
//				var $inp = ui.item.find('input')
//				// Oh! So excellent. This works! Write less, do more!
//				// Okay not quite right-- needs to trigger "dirty"
//				var pkn = $inp.pekoeNode; // the moved item
//				var $prev = ui.item.prev();
//				// not quite so simple here. If the prev element isn't a fieldset, then I'll have to
//				// dig to work out what it is and where the pekoeNode is to be found.
//				// it could be a span, label
//				// how can the "reorder" rules be applied?
//				// I guess it's not so hard: "peers" means others of the same kind and within the same group (e.g. Links)
//				// (might need better names than these)
//				// "siblings" means anywhere within the item's parent (but not into any children)
//				// and "anywhere" is interesting but achievable.
//				var elderP = $prev.find('input').get(0).pekoeNode; // its new preceding-sib
//				// should have a function here to investigate the whereabouts of the pekoeNode. Could use the schema.
//				if (elderP && pkn) {
////		    		console.log("going to move",pkn,"after",elderP);
//					jQuery(elderP).after(pkn);  // move it.
//				} else {
//					console.warn("Can't move because one or other of these is null. Prev FS (elderP):",elderP, "and pkn:",pkn);
//					jQuery.statusMessage("Can't move " + ui.item.attr("title") + " after " + $prev.attr("title"));
//				}
//			}
//		});


		//jQuery('span.repeating').sortable();

		jQuery('.tx-controls').on('keydown','.repeating>input[type=text]', function (event) {
			if (event.which === 13) {
				event.preventDefault();
				if (event.shiftKey) {
					$(this).siblings('.add').click();
				}
			}
		});

		jQuery('input[type=date]').datepicker({dateFormat:'yy-mm-dd'});
		//jQuery("fieldset.repeating:").append("<i class='fa fa-sort pull-right'></i>");
	    
	    // Perhaps a better approach would be to apply widgets by searching for elements with a pekoe-enhancement class, then evaluating the widget data
	    jQuery(".pekoe-enhancement", mform).each (function () {
	    	var enhancement = jQuery.find("input enhancement",this.pekoeNode.ph)[0];
	    	if (enhancement) {
		    	var $field = $(this);
		    	try {
		    		eval(jQuery(enhancement).text());
		    	} catch (e) {console.warn("ENHANCEMENT ERROR:",e); }
	    	}
	    });

        // Editable Rich text ------------------------------------------- EDITABLE RICH TEXT -------------------------
        // Beautiful.
        jQuery(".rte").each(applyRTE);

        // AUTOCOMPLETE LOOKUP ------------------------------------------- AUTOCOMPLETE ON FRAGMENT LOOKUP -------------
        // Apply the pekoeLookup widget to any input with class .fragment-lookup or .autocompleter
	    jQuery(".fragment-lookup, .autocompleter", mform).pekoeLookup();

		
/*		jQuery(".context-menu",mform).on("click",function(){
			jQuery(this).contextPopup({
			  title: 'My Popup Menu',
			  items: [
			    {label:'Some Item',     icon:'icons/shopping-basket.png', action:function() { alert('clicked 1') } },
			    {label:'Another Thing', icon:'icons/receipt-text.png',    action:function() { alert('clicked 2') } },
			    null, *//* null can be used to add a separator to the menu items *//*
			    {label:'Blah Blah',     icon:'icons/book-open-list.png',  action:function() { alert('clicked 3') } }
			  ]},jQuery);
		});*/

	}

    function applyRTE() {
        var $this = jQuery(this);
        var editor = $this.ckeditor({'entities_processNumerical':'force', placeholder:'Editable text...'}).editor;
        var $pekoeNode = jQuery($this.data("pekoeNode"));
        // not receiving change after paste.
        editor.on('change', function (){
            console.log('got cke change');
            $pekoeNode.empty().append(jQuery(this.getData()).clone());
        });
    }
	
	mergerUtils.showAutocomplete = function (formElement,xmlResponse) {
		var data = [];
		jQuery( "exist\\:result,result", xmlResponse ).children().each(function(k) {
			var $this = jQuery(this);
			data[k] = jQuery.trim($this.text());
		});

		jQuery( formElement).autocomplete({
			autoFocus: false,
			minLength: 0, // no need to enter anything
			source: data,
			select: function( event, ui ) {
				jQuery(this).val(jQuery.trim(ui.item.value));
				jQuery(this).trigger("change"); // alternatively might want to set the pekoenode explicitly 
			}
		}).autocomplete("search",""); 
	}; 
	
//	If a field is marked as "repeating" then this method is attached to a button next to the field. WILL NOT BE APPLIED TO Attributes.
mergerUtils.replicateElement = function (pkn, formEl) {
		// this procedure creates a new  pekoeNode in the the document
		// and renders a new form element by directly calling ElementMaker
		// replicate the pekoeNode
		var od = pkn.ownerDocument;
		var nn = od.createElement(pkn.nodeName);
		if (pkn.ph) {
		 	nn.ph = pkn.ph; // link the placeholder info
			if (pkn.hasAttributes()) {
			 	// only interested in attributes that are also pekoeNodes
                var atts = pkn.attributes;
	 			for (var i = 0; i< atts.length; i++  ) {
					var a = atts.item(i);
					if ((a.ph) && (a.ph !== null)) {
						var attr = document.createAttribute(a.nodeName);
						attr.nodeValue = "";
						attr.ph = a.ph;
						nn.setAttributeNode(attr);
					}
				}
			 }
		}
		// there is no appendSibling method in the DOM
		var sib = pkn.nextSibling;
		var parentN = pkn.parentNode;
		if (sib != null) {
			parentN.insertBefore(nn,sib);
		} else {
			parentN.appendChild(nn);
		}	

		
		// replicate the FORM element
		var newFS = document.createDocumentFragment();
//        console.log('Utility.replicateElement calling InputMaker for',pkn.nodeName);
		gs.Pekoe.merger.InputMaker(newFS,nn);
		// created a fragment - the contents. 
		var el = newFS.firstChild;
		jQuery(el).hide();
		sib = formEl.nextSibling;
		parentN = formEl.parentNode;
		if (sib != null) {
			parentN.insertBefore(newFS,sib);
		} else {
			parentN.appendChild(newFS);
		}	
		jQuery(el).show('slow').find('input').focus();
        // now need to check if there are any enhancements.
        // problem with the
		if (jQuery(el).find('input').is('.autocompleter')) { jQuery(el).find('input').pekoeLookup(); } // any other enhancements that should be applied?
        jQuery(el).find('.rte').each(applyRTE);
	};
	
mergerUtils.deleteMe = function (fieldset) {
	var txt = "Do you want to delete " + fieldset.title;
	if (confirm(txt)) {   // TODO assess consequences!						
		jQuery(fieldset).hide('slow',function () {	
			jQuery(fieldset.pekoeNode).remove();					
			jQuery(fieldset).trigger("dirty");	
			jQuery(fieldset).remove();						
		});
	}
};

	
mergerUtils.addMe = function (fieldset, isCopy) {
	// addMe is used to replicate or duplicate a Fragment.
	// - replicate (isCopy==false) only copies the structure
	// - duplicate also copies the values.
	
//	var fsTitle = fieldset.title;
	// the fieldset has a reference to the xTree fragment Element
	// the Element has a placeholder ph
	//console.log("about to duplicate " + fsTitle + " with pn: " + fieldset.pekoeNode.ph.name);

	// the form fieldset is linked to a part of the xTree. 
	// clone that part of the tree, insert it after it's original, and then 
	// call "toForm" on it.
	
	var pkn = fieldset.pekoeNode;
	
	var newNode = null;
	if (isCopy === false) {  // want to replicate (not Duplicate) this fragment. Easiest to get it from the fragment tree and enhance it.
		var od = pkn.ownerDocument;
		var doctype = jQuery(od).children().get(0).nodeName;
		var schema = schemas[doctype];
		var fragment = schema.getTemplateFragment("/fragments/" + pkn.nodeName);
		if (fragment == "") {console.warn("addMe found nothing in the fragments tree - stopping"); return;}

		newNode = od.importNode(fragment,true);
		enhanceSubtree(schema,newNode, pkn.nodeName);
		if (pkn.ph) {
			 newNode.ph = pkn.ph; // copy the placeholder info
			 //if (jQuery(newNode.ph).attr("fieldType") == "fragmentRef") {
			// TODO - does "choice" go here?
			if (newNode.ph.nodeName === 'fragment-ref') {
			 	newNode.toForm = gs.Pekoe.fragmentNodeForm;
			 	
			 } else {
			 	newNode.toForm = gs.Pekoe.pekoeNodeForm;
			 }
		}
		
	} else { // want a straight copy
		newNode = pkn.cloneNode(true); // Deep clone when copying
		duplicate(pkn, newNode); // find and attach the placeholder info. Why doesn't "enhanceSubtree" work here?
	}
	
	// might be easier to walk the subtree. Interesting question is whether the whole subtree should be copied, or
	// just the visble parts. I'll copy the whole thing.

	var sib = fieldset.pekoeNode.nextSibling;
	var parentN = fieldset.pekoeNode.parentNode;
	if (sib != null) {
		parentN.insertBefore(newNode,sib);
	} else {
			parentN.appendChild(newNode);
	}		

	var newFS = newNode.toForm();
	jQuery(newFS).hide();
	sib = fieldset.nextSibling;
	parentN = fieldset.parentNode;
	//console.log(parentN);
	if (sib != null) {
		parentN.insertBefore(newFS,sib);
	} else {
		parentN.appendChild(newFS);
	}	
	applyEnhancements(newFS);
	jQuery(newFS).show('slow'); 
};

mergerUtils.duplicate = duplicate;

function duplicate(source, dest) {
	// what happens if source is an attribute and dest hasn't been constructed?
	if (!dest) {console.warn("form Utility duplicate No dest for source",source.nodeName,source);}
	// assume the trees have been constructed (using a clone operation) and that source and dest are a single node
	// this function attaches the ph field-info to each dest Element (and attribute) where one exists in source
	if (source.ph) {
		 dest.ph = source.ph; // copy the placeholder info
		 // what kind of node is this?
		 //if (jQuery(dest.ph).attr("fieldType") == "fragmentRef") {
		// TODO - does "choice" go here?
		 if (dest.ph.nodeName === 'fragment-ref') {
		 	dest.toForm = gs.Pekoe.fragmentNodeForm;
		 } else {
		 	dest.toForm = gs.Pekoe.pekoeNodeForm;
		 }
	}
	// it took about 4 hours to work out that this block was necessary:
    var sourceAtts = source.attributes;
	if (sourceAtts) {
		// The attributes of an xTree node can have field-info
		for (var i = 0; i < sourceAtts.length; i++) {
			duplicate(sourceAtts[i], dest.attributes[i]);
		}
	}
	var fns = source.childNodes;
	var cns = dest.childNodes;
	try {
	for (var j = 0; j< fns.length; j++) {
		if (!(fns[j].nodeName == "#text")) {
			if (fns[j].nodeName != cns[j].nodeName) {console.error("Different nodes!! " + fns[j].nodeName + ", " + cns[j].nodeName);}
			duplicate(fns[j], cns[j]);
		}
	}
	} catch (dupError) { console.warn("Utility.duplicate error", dupError); }
}

	
 mergerUtils.xpathResultToString = function(xpr) {
	var resultString = "";
	var type = "unknown";
	if (xpr == null) return "";
	switch (xpr.resultType) {
		
		case XPathResult.STRING_TYPE:
			type = "STRING";
			resultString = xpr.stringValue;
			break;
		case XPathResult.NUMBER_TYPE:
			type = "NUMBER";
			resultString = xpr.numberValue;
			break;
		case XPathResult.BOOLEAN_TYPE:
			type = "BOOLEAN";
			resultString = xpr.booleanValue;
			break;
		case XPathResult.FIRST_ORDERED_NODE_TYPE:
		case XPathResult.ANY_UNORDERED_NODE_TYPE:
		 	resultString = xpr.singleNodeValue.textContent;
		 	break;
		case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
			type = "ITERATOR";
			var oEl = xpr.iterateNext();
			var strBuff = [];
			while (oEl) {
				strBuff.push(oEl.textContent);
				oEl = xpr.iterateNext();
			}
			resultString = strBuff.join(" "); 
			break;
		default: 
			console.warn("defaulted on this XPR.resultType:",xpr.resultType,"nodeType:",xpr.nodeType,"with textContent:",xpr.textContent);
			if (xpr.textContent != "") { 
				resultString = xpr.textContent.trim();
			}
	}	

	return resultString;
};

mergerUtils.addMeInTheRightPartOfTheTree = addMeInTheRightPartOfTheTree;
    /*
	OUT OF DATE
     gs.schemas["schema"].fragmentsTree.firstChild
     <fragments> NOTE that copy from console doesn't include all of the xml ...
         <field path="" fieldType="">
         <input type="" size="" rows="" source="">
         <lookup one-shot="" path="" applies-to="" type="">
         <output name="">
         <fragment name="">
         <field path="" fieldType="">
         <output name="">
         </fragment>
     </fragments>

     gs.schemas["schema"].sampleTree.firstChild
     <schema for="">
         <fragment></fragment>
         <field></field>
     </schema>

     here' the sample tree shows the fragment is first.
     So add a fragment to the beginning of any schema missing it.

     This is very similar to constructTreeFromPaths below. Can they be combined?

     */

function addMeInTheRightPartOfTheTree(tree, schema, pathParts, child) {
	// Add to the tree, using the field ordering obtained from the sampleTree. 
	// Note - the sample tree consists of top-level elements only (ie first-children of root element)
	// An ad-hoc field will be prepended to the existing parent. It is possible to change this behaviour (see below)
//    console.log('addMeInTheRightPartOfTheTree',pathParts,child); // ['schema', 'fragment'] <fragment>

	var fieldInSampleTree = jQuery(pathParts.join(" > "), schema.sampleTree); // <fragment>. (I would prefer an XPath.)

    pathParts.pop();
	var parentPath = pathParts.join(" > ");

	// easier to use this recursive function than write a complex loop
	// TODO except when it doesn't terminate
	function precedent(n) {
		 if (n.length) { // .prev returns an array
			var nn = n.get(0).nodeName;
			// find this in the Job tree
			var sib = jQuery(parentPath + " > " + nn, tree); // selector
			if (sib.length > 0) {
				return sib.last(); // get the last one. 
			} else {
				return precedent(n.prev()); // try the next preceding sib in the sampleTree
			}
		}
		return null; // no preceding sib
	}
	// --- use it...
    if (fieldInSampleTree.length === 0) {
        console.warn('field not found in sampletree',pathParts.join(' > '));
        return null;
    }
	var prevSib = precedent(fieldInSampleTree.prev());
	if (prevSib) { // did we find one?
		jQuery(prevSib).after(child);
	} else {
        // didn't find a previous sibling so perhaps just add at the beginning.
//		console.log("didn't find prevSib. Looking for parentPath",parentPath);
		var parent = jQuery(parentPath, tree); // selector
//        console.log('parent',parent);
		if (parent.length > 0) { // why length? This is the recursion gate
			// might shift ad-hoc fields. 
			jQuery(parent).prepend(child); // if desired, ad-hoc field could be .appended after testing child.isDefault.
		} else {
			// go up a level to see if parent exists. if not, create parent, attach child, and search for parent's elder sibs.
			var parentName = pathParts[pathParts.length - 1];
			var p = tree.createElement(parentName);
			//var p = jQuery("<"+ parentName + "/>",tree);
			jQuery(p).append(child);
			addMeInTheRightPartOfTheTree(tree, schema, pathParts, p);
		}
	}
}

//mergerUtils.constructTreeFromPaths = constructTreeFromPaths; //TODO - is this cruft?
/*
    constructTreeFromPaths is a significant feature of PekoeForm.
    It allows an XML tree to be created from a list of paths.
    It turns out that this is harder to achieve in XQuery than in Javascript (it was harder for me, anyway)
    I chose to work from the leaf node up - as it's more likely the leaf will need to be created than the root.
    constructTreeFromPaths will ensure that the document contains the path.
 */
function constructTreeFromPaths(theContextNode, thePath, theChild){
    var isAttribute = thePath.indexOf('@') > -1;
    var theAttr;
    if (isAttribute) {
        var pathParts = thePath.split('/@'); // field/@path -> [field, path]
        thePath = pathParts[0];
        theAttr = pathParts[1];
    }

 	function appendNode(thisChild, theParent) {
        switch (thisChild.nodeType) {
            case (Node.DOCUMENT_FRAGMENT_NODE):
            case (Node.ELEMENT_NODE) :
                theParent.appendChild(thisChild);
                break;
            default:
                theParent.textContent = thisChild;
        }
	 }

	var reIndex = /\[\d*\]/; // searching for positional predicate (e.g. [2]) ( TODO - Is positional predicate cruft? Check CM schema)
 	if (thePath === "") {return null;}

    /*
    Document.createExpression -> XPathExpression for repeated use (no easier to use than this...
    Document.evaluate
    Node.selectNodes IE
    Node.selectSingleNode IE

    The major difference is that the Document in question must be the one which is being evaluated - whereas the
    oEvaluator is just a function. Also, it seems buggy.
     */
 	var oResult = gs.Pekoe.oEvaluator.evaluate(thePath, theContextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE,null);
 	// one approach is to check each branch on the path from root to leaf. 
 	// but the other approach is to check the full path first. If it exists we're finished. If not, we need to
 	// construct the leaf node as a minimum, then see if its parent exists. This is the same approach as
 	// appendWithParents
 	var thisNode = null;
 	if ((oResult != null) && (oResult.singleNodeValue != null)){
        // what if there's more than one? Is that possible?
 		// we have a result. Do we need to append a child?
		thisNode = oResult.singleNodeValue;
        if (isAttribute) {
            thisNode.setAttribute(theAttr,theChild);
        } else {
            appendNode(theChild, thisNode);
        }
	} else {
		// create the last node in the path, append the child and then recurse
		var newPath = thePath.substring(0, thePath.lastIndexOf("/"));

		var newElName = thePath.split("/").pop();
		if (reIndex.test(newElName)) {
            newElName = newElName.replace(reIndex,"")
        }

		var theDocument = (theContextNode.nodeType == Node.DOCUMENT_NODE) ? theContextNode : theContextNode.ownerDocument;
        thisNode = theDocument.createElement(newElName);
        if (isAttribute) {
            thisNode.setAttribute(theAttr,theChild);
        } else {
            appendNode(theChild, thisNode);
        }

		constructTreeFromPaths(theContextNode, newPath, thisNode); // ignore return
	}
 	return thisNode;
 	
 }

// it's the global list of ph paths- with  additional formatting info
// it will be converted into: a) the fragmentsTree; b) the fragmentDefinitionsList; and c) the fieldDefsByName
 mergerUtils.currentDoctype = "";
 
mergerUtils.loadSchema = function (doctype) {

	// Nice - but annoying when testing. Can this be a user setting? 
	// Use "delete gs.schemas['school-booking']" to overcome this issue while testing. 
	if (schemas[doctype] && schemas[doctype] !== null) {
		return schemas[doctype]; 
	}
	
	var schema = makeSchema({doctype:doctype});
	schemas[doctype] = schema;
	/*
	 * 		doctype: "", 
			path: null, 
			fieldDefsByPath : {}, 
			fragmentsTree:null
	 */

	var req = jQuery.get(
		"/exist/restxq/pekoe/schema/" + doctype,
		function (d) {
			buildFragmentsTree(d,schema); 
		} 
	);
	schema.request = req;
	return req;
};


 // does the template path-tree contain a fragment for the leaf-node of this path?

 function getTemplateFragment(thePath) {
 	// **** looking for the leaf of this path at the root of the tree **** 
 	// the path is expected to be complete
 	
 	var pathParts = thePath.split("/");
 	var fragmentName = pathParts[1] + "/" + pathParts.pop();
 	// started with /fragments//txo/property/vendor/person and end up looking for fragments/person

 	// This function uses the fragmentRef to find a generated fragment. An Attribute CAN'T be a fragmentRef 
 	


 	try {
 	var oResult = gs.Pekoe.oEvaluator.evaluate(fragmentName, this.fragmentsTree, null, XPathResult.FIRST_ORDERED_NODE_TYPE,null);
 	if ((oResult != null) && (oResult.singleNodeValue != null)){
 		return oResult.singleNodeValue;
 	}
 	} catch (e) { console.error('getTemplateFragment - fragmentName:',fragmentName, 'from', thePath,e); }
 	
 	return ""; // return empty string if no existing Fragment
 }
 
 
// TODO Replace this with a Server-side function. Could be pre-generated when the schema 
 // changes unless I want to deliver a specific version based on context 

 
 function buildFragmentsTree(data, thisSchema) { // the data have come from the server as a schema document.
 // this SHOULD be a server-side function - performed when the schema is updated - or on request with caching.

 	
		var $schema = jQuery(data);  // no longer E4X.
		thisSchema.schema = $schema;


     // make a list of all fragments with lookups.
         $schema.find('fragment').each(
             function() {
                 var $fragment = $(this);
                 // need to test whether the lookup has any useful content. HOW?  **********************
                 if ($fragment.children('lookup').length > 0) { // this is scanning for any descendant. So it's wrong.
                     // possible that it has a lookup but no script or path
                     // TODO - determine the best test for a non-empty lookup
                     var $lookup = $fragment.children('lookup');
                     var script = $lookup.find('script');
                     var path = $lookup.attr('path');
                     //var thescript = script.length ? script.text() : '';
                     //console.log('fragment lookup?',$lookup,thescript,path);
                     if (path || (script.length && script.text())) {
                         console.log('adding fragmentLookup for',$fragment.attr('name'));
                         thisSchema.fragmentLookups[$fragment.attr('name')] = $lookup.get(0);
                     }

                 }
             }
         );

		$schema.find("field,fragment-ref,choice").each(  // create a hash of the field/@paths for later retrieval
			function () {
				var $field = jQuery(this);
				thisSchema.fieldDefsByPath[  $field.attr("path") ] = this;
                // now, somehow want to use the path to determine whether the fragment has a lookup
                //first check for frag-ref...
                if ($field.is('fragment-ref')) {
                    //console.log('got fragment-ref with path',$field.attr('path'));
                    // next, test to see if this frag-ref already has a lookup. THEY ALL DO.
                    // need to test whether the lookup has useful content. How? (see above) ***************


                    var $lookup = $field.find('lookup');
                    var script = $lookup.find('script');
                    var path = $lookup.attr('path');
                    if (path || (script.length && script.text())) {
                        console.log('FIELD lookup has content');

                    } else {
                        var fragName = $field.attr('path').split('/').pop();
                        if (thisSchema.fragmentLookups[fragName]) {
                            console.log('FOUND A FRAGMENT LOOKUP for',fragName);
                            $field.get(0).appendChild(thisSchema.fragmentLookups[fragName].cloneNode(true));

                        }
                    }


                    // one option is to copy the lookup element from the fragment. I'll try that. It might be a little expensive
                    // but it saves some hacking elsewhere.
                }
                //console.log('thisElement',thisElement);
			});


			
		/* SAMPLE tree is simple
		 * <events>
				<event></event>
			</events>
		 */
	 	// NOTE. both fields and fragment-refs can be Absolute or Relative paths. A Relative path indicates that the element is a "fragment"
	 	// now process each full field (absolute path) to make the sampleTree
		$schema
			.find("field,fragment-ref,choice")
			.filter(function () { return jQuery(this).attr("path").indexOf("/") === 0; }) // these are absolute paths
			.each(function () {
				var $p = jQuery(this);
				var selectStmt =  $p.attr("path");
				var defaultValue = jQuery("defaultValue", $p);
				var dV;
				if (defaultValue.length === 1) { 
					dV = jQuery(defaultValue.get(0)).text();
				}
				var theNode = constructTreeFromPaths(thisSchema.sampleTree,selectStmt,"");
				if (dV) {
					jQuery(theNode).text(dV);
				}
		});

	 // for some strange reason I'm constructing the fragments tree AFTER the sample tree
		
		/*
		 * Now make the fragmentTree
		 * <fragments>
				<days>
					<start-date></start-date>
					<end-date></end-date>
				</days>
				<hours>
					<start-dateTime></start-dateTime>
					<end-dateTime></end-dateTime>
				</hours>
				<event> here's where I want to put an <pekoe-option> element (somehow) ALTERNATIVELY, mark this element with a pekoe:option attribute
					<days>
					<hours>
					<title></title>
				</event>
			</fragments>
		 */
	 var isFragment = /^[^///].+\/.+/; // the string does not begin with a /  BUT DOES CONTAIN A / - which means a relative path - a "fragment"

	 // TODO - how does the "fragment" element change this? (Should it?)
	 $schema // now process only fragment Fields
			.find("field,fragment-ref,choice")
			.filter(function () { return isFragment.test(jQuery(this).attr("path")); }) 
			.each(function () {
//				var p = this;
				var $p = jQuery(this);
				var defaultValue = jQuery("defaultValue", $p);
				var dV;
				if (defaultValue.length === 1) { 
					dV = jQuery(defaultValue.get(0)).text();
				}
				var selectStmt =  "/fragments/"  + $p.attr("path");
			    // before adding the fragment to the fragments tree, check to see if it is a fragment reference. (But wouldn't it be a fragment-ref?)
			 // I am suspicious of this bit...
				var child = thisSchema.getTemplateFragment(selectStmt);
				if ((child.nodeType == Node.DOCUMENT_FRAGMENT_NODE)|| (child.nodeType == Node.ELEMENT_NODE)) { // why would it be a document_fragment ???
					//console.log('got TemplateFragment of',selectStmt);
					// if there is a child, then it will replace the leaf on this path
					selectStmt = selectStmt.split("/");
					selectStmt.pop();// if we're going to append a child-fragment, then remove the leaf node name from the path
					selectStmt = selectStmt.join("/"); 
					child = child.cloneNode(true);
				} 
				//console.log('construct tree for',selectStmt);
			 // I don't want to add input/list to input. I just want a definition for it.
			 // TODO - what if this was a "choice" element?
			 	if ($p.find("options").text().indexOf("field-choice") >=0) {
					console.warn("FIELD CHOICE FOR ",selectStmt);
					return;
				}
				var theNode = constructTreeFromPaths(thisSchema.fragmentsTree,selectStmt,child);
				if (dV) { // default value
					jQuery(theNode).text(dV);
				}
		});
	 }
 
 
 
 mergerUtils.getSchema = function (doctype) {
 	if (doctype == null) {console.error("No doctype"); return;}
 	var s =  schemas[doctype];
 	if (!s) { console.error("No schema for",doctype); return;}
 	return s;
 };
 
 mergerUtils.getFragmentsTree = function (doctype) {
 	return schemas[doctype].fragmentsTree;
 };
 
 
// find parts of the tree where the leaves are empty. These can be hidden.
    mergerUtils.markForHiding = function (theTree) {

        // select all leaf nodes. Observe the state of the leaf AND ATTRIBUTES. "empty=true" else "empty=false"
        // If empty = false, walk up the tree to the root, setting Node.empty=false.
        // If empty = true, walk up the tree, setting Node.empty=true. Stop if encountering "empty = false".
        var oResult = null;
        var collector = null;
        var leafNodeCountXPath = "//*[count(child::*|@*) = 0]"; // find Leaf Nodes using XPath filter (any element without children must be a leaf-node)
        try {
            oResult = gs.Pekoe.oEvaluator.evaluate(leafNodeCountXPath, theTree ,null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        } catch (e) { console.warn("No leaf-nodes found in this tree!",e);}
        if (oResult != null) {
            collector = [];
            var oElement = oResult.iterateNext();
            while (oElement) {
                collector.push(oElement);  // can't modify the subject of an iterator!!
            oElement = oResult.iterateNext();
        }
        var od = (theTree.nodeType === Node.DOCUMENT_NODE) ? theTree : theTree.ownerDocument;

        jQuery.map(collector,function(subjectNode){
            var markAllNotEmpty = function (p) {
                while (p !== od) {
                    p.pekoeEmpty = false;
                    p = p.parentNode;
                }
            };
            var parentN = subjectNode.parentNode;
            // need to look for text AND attributes
            if (subjectNode.firstChild !== null && subjectNode.firstChild.nodeType == Node.TEXT_NODE) {
                // not empty, walk up to the root, setting empty=false on all nodes on the path
                markAllNotEmpty(parentN);
            } else {
				while (parentN !== od && parentN.pekoeEmpty === undefined) {
					if (parentN.hasAttributes() > 0 ) {
						markAllNotEmpty(parentN); // should take us up and out.
					}else {
						parentN.pekoeEmpty = true;
						parentN = parentN.parentNode;
					}
				}
				// empty; walk up until finding "empty=false". Set empty=true on every node except the last
            }
        });
        }
    };
 
    mergerUtils.mirrorNodes = mirrorNodes;
    // this function probably needs replacing with the one from PekoeForm.js
    // this is run by Lookup.
    function mirrorNodes(fragment, source) {
        // import a complete copy of the fragment
        var nn = source.ownerDocument.importNode(fragment,true);
        // for every child node, see if it exists in the source. If so, move it to the nn
        var fragmentChildren = nn.childNodes;
        var fcCount = fragmentChildren.length;
    //	console.log("found ", fcCount, "children");
        for (var i = 0; i < fcCount; i++){
    //		console.log("processing ", i);
            var fragChild = fragmentChildren[i];
            var matchingNodes = source.getElementsByTagName(fragChild.tagName); // THIS is fatal
    //		console.log("matchingNodes",matchingNodes);
            if (matchingNodes.length > 0) {

                for (var m = 0; m < matchingNodes.length; m++ ) {
    //				console.log("going to insert",matchingNodes[m])
                    nn.insertBefore(matchingNodes[m], fragChild);
                }
                nn.removeChild(fragChild);
            }
        }
        // then, append any remaining source children to the fragment,
    //	console.log("source childnodes now",source.childNodes);
        var remaining = source.childNodes;
        for (var n = 0; n < remaining.length; n++ ) {
                nn.appendChild(remaining[n]);
        }
        //finally replace the source with the fragment.
        var p = source.parentNode;
    //	console.log("about to replace",source, "with",nn);
        p.replaceChild(nn,source);
        return nn;
    }

 
    mergerUtils.enhanceSubtree = enhanceSubtree;

    // enhanceSubtree : function (subjectNode,currentPekoeNode, fragName) {
    function enhanceSubtree(schema, subjectNode, fragName) {
        // process the attributes first:
    //	console.log("enhance subtree",fragName);
        if (!schema) {console.error("enhanceSubtree No SCHEMA"); return;}

        if (subjectNode.hasAttributes()) {
            var attrs = subjectNode.attributes;
            for (var i = 0; i < attrs.length; i++) {
                var a = attrs.item(i);
                var pathToHere = [fragName,a.nodeName].join("/@");
    //			console.log('examine Attribute',subjectNode.nodeName, '/@',attrs.item(i).nodeName, 'aka',pathToHere);
                // the problem is that I've created frog/Distribution/@src - but here I'm looking up Distribution/@src

            // "person/address" or "person/firstname" -- both of these are fragments. The former is also a fragRef
            // both can be found in the fieldDefsByName
                var phDef =  schema.getFragmentDefsByPath(pathToHere);
                // USING jQuery(gs.defaultField).attr("path",f).get(0) here will cause the attribute to be displayed as a field
                if (phDef == null) {
                    console.warn("No definition for fragment attribute: ",pathToHere);
                }
                else { // a phDef exists for this node
                    a.ph = phDef;
                }
            }
        }

        jQuery(subjectNode).children().each( function () {
            var n = this;
            if (n.nodeType == Node.TEXT_NODE) return;
            // "address" or // "firstname"
            var pathToHere = [fragName,n.nodeName].join("/");
            // "person/address" or "person/firstname" -- both of these are fragments. The former is also a fragRef
            // both can be found in the fieldDefsByName
            var phDef =  schema.getFragmentDefsByPath(pathToHere);

            if (phDef == null) { // PEKOE-TODO: figure out whether this is needed. An element is being added unnecessarillylyli

                console.warn("No definition for fragment part: ",pathToHere); // so why add this?
                // what about possible children?
                enhanceSubtree(schema, n, n.nodeName); // extend the fragmentName looking for eg. frog/Images/img/@src
            } // eg. frog/Images - but why is this a fragment part?
            else { // a phDef exists for this node
                n.ph = phDef;
                //if (jQuery(phDef).attr("fieldType") == 'fragmentRef') { // continue towards the leaves
				// TODO - does "choice" go here?
				if (phDef.nodeName === 'fragment-ref') {
                    n.toForm = gs.Pekoe.fragmentNodeForm;
                    enhanceSubtree(schema, n, n.nodeName);
                } else {
                    if (n.hasAttributes()) {enhanceSubtree(schema,n,fragName + "/"+ n.nodeName);}
                    n.toForm = gs.Pekoe.pekoeNodeForm;
                }
            }
        });
     }
 
    /*
    * fragmentNodeForm appears in 4 places here. (But it's defined in PekoeForm.js)
    * I want to add a new kind of thing called a field-option reference
    * It can contain multiple fragmentRefs, Fields or other Field-options (I suppose)
    * It will have a type "one-of | any-of"
    * It will generate a fieldSet whose label will be the containing element. Hmm.
    * For example:
    *     <field-option path-element="event" type="one-of">
            <field path="event/days" fieldType="fragmentRef">  ... </field> (This should really become a <fragmentReference path="event/days" /> )
            <field path="event/hours" fieldType="fragmentRef"> ... </field>
        </field-option>
    * Where does this fit into this generative code? How does it get applied to existing Trees?
    * This is a major change to the schema. I don't know where to start
    * PERHAPS I insert an <pekoe-option> element into the fragmentsTree or event the full tree.
    * Then, when rendering, this element can be removed and the content inserted according to the rules?
    */
     // TODO work out where to start with field-option

     // the placeholder list is a hash of the selected field-defs for this template
     // this is where ordinary nodes have form element info attached

    mergerUtils.attachPlaceholderInfo = function (schema, xTree, placeholderList) {
        // I really think this could be done in the first pass through the tree in displayTemplateContent
        // but does the original tree have all the required parts?
        if (!schema) {console.error("attachPlaceholderInfo No SCHEMA"); return;}
            jQuery.each(placeholderList, function (fieldPath, currentPlaceholder) {
    //			console.log("getting placeholder info for",fieldPath,currentPlaceholder);
                // if this is an attribute, it can't be a fragmentRef. We must check the path anyway
                var $c = jQuery(currentPlaceholder);
                jQuery(xTree) //.ownerDocument)
                    .find(fieldPath.replace(/^\//,"").replace(/\/@.*/,"").replace(/\//g," > "))
                    .each(function () {
//                    console.log("attachPlaceholderInfo",this.nodeName);

                    //if ($c.attr("fieldType") == 'fragmentRef') {
						// TODO - does "choice" go here?
					if (currentPlaceholder.nodeName === 'fragment-ref') {
                        this.ph = currentPlaceholder; // the subject node IS the pekoeNode.
    //					console.log("attaching fieldInfo to FRAG");
                        this.toForm = gs.Pekoe.fragmentNodeForm;
                        var fragName = fieldPath.split("/").pop(); // get the last path item.
                        enhanceSubtree(schema, this, fragName);
                    } else if (fieldPath.indexOf("@") !== -1) { // it's an attribute and we've only selected the parent element
                        // how do I "get" the attribute, with jQuery. (jQuery would expect me to attach the "toForm" method as data)
                        // what is the name of the attribute?
                        var attrName = fieldPath.replace(/^.*@/, ""); // get the characters after the @
                        var attr = this.attributes.getNamedItem(attrName); // eek - cumbersome DOM
                        attr.ph = currentPlaceholder;
                        //TODO I need to pass the Element in here - so need some way to curry this function
                        var pekoeAttrForm = (function (el) {
                            return function () {
                                var formEl = document.createDocumentFragment();
//                                console.log('calling pekoeAttributeForm on the attr', this, 'of element', el); // "this" is Window !!!
                                gs.Pekoe.merger.InputMaker(formEl, this, el);
                                return formEl;
                            }
                        })(this);
                        attr.toForm = pekoeAttrForm;


//                    } else if (this is a choice selector) { // TODO assess this possibility.
                    } else{
//    					console.log("attaching fieldInfo to leaf",this.nodeName);
                        this.ph = currentPlaceholder; // the subject node IS the pekoeNode.
                        this.toForm = gs.Pekoe.pekoeNodeForm;
                    }
                });
            });

     };
     return mergerUtils;
}();