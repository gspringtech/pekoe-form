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

if (!gs.Pekoe.merger) {gs.Pekoe.merger = {}; }
//gs.Pekoe.merger.nodeId = 0;

/*

 *
 * Everything is dependent on the fieldDefinition - which has been attached to the pekoeNode:
 *          pekoeNode.ph (it needs to be renamed, and attached via .data() )
 * Every decision.
 * It is a kind of "spec" object. The pekoeNode itself is the State object
 * SO - I should be using the PH as the config object in a Functional Constructor.
 * AND create the SPEC object ONCE when needed - not for each field as is current.
 *
 * See Utility lines 843 EnhanceSubtree and 914 attachPlaceholderInfo
 * e.g. this.ph = currentPlaceholder;
 * it should be
 * var fieldMaker = fieldSpecFor(currentPlaceholder);
 *
 * This InputMaker is only called from two places in Utility
 * ReplicateElement and attachPlaceholderInfo
 *  and two places in PekoeForm
 *  in fragmentNodeForm (for attributes) and PekoeNodeForm (which can probably be moved back to Utility)
 *
 * BUT it's called for every INPUT. Which means I'm reconstructing all this stuff every time.
 *
 * Each of the input-type functions below should be in their own functional constructor
 *
 * pekoeComponent = {docNode:docNode, pekoeNode: pekoeNode, parentElement: parentElement};
 *
 * textInputMaker = function (spec, pekoeComponent) {
 *   return that
 * }
 *
 * ALSO REMEMBER DEPENDENCY INJECTION like Angular as a way of providing access to services
 *
 * The field types determine the end result. Some of the functions here only apply to dates.

 * Really should be approaching this from the jQuery angle. Plugins! Instead of this enormous structure, attached (via closure) to
 * each node in the document, there should be a jQuery "live" function that applies schema data only when needed.
 *
 * What happens here, and why?
 *
 * We're creating the HTML Input field and any associated elements such as label.
 * We're attaching the pekoeNode (from the sourceDoc) to the element - with an updater function
 * We're enhancing the element by adding actions as needed.
 *
 *
 * REFACTORING IDEAS ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 * Put the common functions into one object.
 * Use the extend method (or object creator) to turn that object into the individual field types
 *
 * OR make this a singleton constructor so that "class" methods and variables are separate.
 * Then identify all instance variables and places where closure is used. (!! hard!!)
 *
 * ElementMaker then creates an Object of one of these types.
 *
 * +++ ElementMaker calls itself if the current Node contains any Attributes that are pekoeNodes. +++

 */
// ------------------------------------------------------------------------------   BEGINNING of elementMaker ---------------------------------
gs.Pekoe.merger.InputMaker = function (docNode, pekoeNode, parentElement) {
	"use strict"; // EC5 Directive.
	// what does it return? - the formElement along with an enormous stack for closure.
	// there's an indirect function call about half-way down (line 380) which selects the element type and processes the docNode and pekoeNode.
	// there are a bunch of large private methods (private functions)
	// the docNode is normally a documentFragment - but if the pekoeNode is an attribute-node, then it will be the parent element's input
//	console.log("ElementMaker for",pekoeNode.nodeName);

    // if parentElement not undefined then the pekoeNode is an ATTRIBUTE
    var isAttribute = parentElement !== undefined;
    if (isAttribute) pekoeNode.myElement = parentElement; // IS THIS THE BEST PLACE TO DO THIS? WHY NOT DO IT WHERE INPUTMAKER IS CALLED?

	var mergerUtilities = gs.Pekoe.merger.Utility;
	var elementTypes = {};

	// What is this pattern, and can I use it better?
	register("text",textInput); // Seriously dumb - this is called for every element. It should be part of a SETUP or INIT function.
	register("date",dateInput);
	register("dateTime",dateInput);
	register("time",dateInput);
	register("radio",radioInput);
	register("checkbox",checkboxInput);
	register("textarea",textareaInput);
	register("select",selectInput);
	register("multicheckbox",multiCheckBox);
	register("richtext",richTextInput);
	register("field-choice",fieldChoiceInput);


/*
 * VARIABLES:
 * docNode 		- usually a fieldset element within the HTML form we're creating
 * pekoeNode 	- an XML DOM element from the source tree
 * fieldDef - shortcut to pekoeNode.ph
 * options      - shortcut to pekoeNode.ph.input.options
 * currentValue - from pekoeNode.textContent
 * formEl		- the constructed element
 */

	// class function - but I'm doing this for every instance of a field.
    // ***** perhaps that's the clue here - these things need to be applied to the spec - the fieldDefinition - rather than the pekoeNode *****
	var optionManager = function (o) {
		var opts = o.trim().split(/[\s]+/);
		return {
			has: function (what) { return opts.indexOf(what) > -1;}
		};
	};


	var fieldDef = pekoeNode.ph; // INSTANCE - Shortcut
    var pekoeNodeName = (isAttribute) ? pekoeNode.name : pekoeNode.nodeName;
	var $fieldDef = jQuery(fieldDef); // INSTANCE - shortcut

	if (fieldDef == null) { // INSTANCE - initialisation check
		console.warn("missing definition for " + pekoeNodeName);
		return;
	}
	var $inp = jQuery($fieldDef.find("input")[0]); // INSTANCE - NO This is NOT an instance - this is a SPEC item
	var defaultValue = $fieldDef.find("defaultValue").text();
	var options = optionManager($fieldDef.find("options").text());
	var $enhancement = $inp.find("enhancement");
	var isEnhanced = $enhancement.length > 0 && $enhancement.text() !== "";

    // The currentValue is an ACCESSOR function for the pekoeNode (regardless of whether its an Attribute or Element)

    var currentValue = (function(test) { // "test" = "isAttribute"
        if (test) {
            return function (v) {

                if (v === undefined) {
                    return pekoeNode.value;
                } else {
                    pekoeNode.value = v;
                }
            };
        } else {
            return function (v) {
//                console.log('Element',pekoeNode);
                if (v === undefined) {
                    return pekoeNode.textContent;
                } else {
                    pekoeNode.textContent = v;
                }
            };
        }
    })(isAttribute);


	// KEY FEATURE: direct link from form element to xTree node content
    // but only one-way. Consider the other direction.

	// Could this be converted to an Accessor Wrapper without breaking things? Probably not.
	var updateTree = function() { // INSTANCE - METHOD
//		// this is a fairly hefty closure...
//		console.log('Update Tree',this.value,currentValue());
		if (currentValue() == this.value) {
			return;
		}
		currentValue(this.value); // This is the "SET" function.
		if (!isAttribute) { // can't set attributes on an Attribute
            var d = new Date();
            if (options.has('dateStamp') === true) {
                pekoeNode.setAttribute("date-stamp", d.toISODate());
            }
            if (options.has('timeStamp') === true) {
                pekoeNode.setAttribute("time-stamp", d.toString().split(' ')[4]);
            }
            if (options.has('dateTimeStamp') === true) {
                pekoeNode.setAttribute("dateTime-stamp", d.toISODateTime());
            }
        }

	};


	// Date Stamp
	function showDS(formEl,pekoeNode){
		// no point using this if the node IS an attribute!
		if (pekoeNode.nodeType == Node.ATTRIBUTE_NODE) return;
		var ds = pekoeNode.getAttribute("date-stamp");
		if (ds !== null) {
			jQuery("<span class='date-stamp'></span>").text(Date.fromISO(ds).toAustDate()).appendTo(formEl);
		}
		var ts = pekoeNode.getAttribute("time-stamp");
		if (ts !== null) {
			jQuery("<span class='date-stamp'></span>").text(ts).appendTo(formEl);
		}
		var dts = pekoeNode.getAttribute("dateTime-stamp");
		if (dts !== null) {
			jQuery("<span class='date-stamp'></span>").text(dts).appendTo(formEl);
		}
	}


    function showHelp(formEl,pekoeNode){
	var help = $fieldDef.find('help');
	if (help.length && help.text() !== '') {
	    jQuery('<span class="help">?</span>').attr('title',help.text()).appendTo(formEl);
	}
    }

	var formEl = null;

	gs.Pekoe.nodeId ++; // provide a counter as an ID for field inputs

	var inptype = $inp.attr("type");
	if (inptype == ""){
        var inpname = (isAttribute) ? parentElement.localName + '/@' + pekoeNodeName : pekoeNodeName;
	    console.warn("pekoenode",inpname, "has no type"); // Create a schematron validator for Schemas
	}
//	console.log("building input",inptype,"for value",currentValue, "in element",pekoeNodeName)
	// Yetch. This is a function function call. constructElement() returns the appropriate builder method, which we then call.
	// BUT strangely, the functions all depend on access to variables at this level. In particular, the formEl
	try {
	    constructElement(inptype)();	// ***************************************************  the work is done here !!!!!!!!!!!
	} catch (abc) {console.warn("ElementMaker construct element error on",inptype,">",abc);}

	// having constructed the basic form element (input, select, textarea etc) , now finish setting up the field
	// construct a title attribute
	formEl.title = (isAttribute) ? gs.Utility.getElementTreeXPath(parentElement) + "/@" + pekoeNodeName : gs.Utility.getElementTreeXPath(pekoeNode);
	// this is unfortunate - neither the fieldDef@path
	//  nor this function will handle both elements and attributes.  ( what does this mean???)
    var ds;
	if (options.has('dateStamp') === true) {
		ds = pekoeNode.getAttribute("date-stamp") || "";
		if (ds !== ""){
			formEl.title += " Modified: "+ ds;
		}
	}
	if (options.has('timeStamp') === true) {
		ds = pekoeNode.getAttribute("time-stamp") || "";
		if (ds !== ""){
			formEl.title += " : "+ ds;
		}
	}
	// -------------- Add the replicator to the form-element's label if fieldDef.replicate is true

	// What if there were two Calculations? e.g. 'Get Receipt number' 'Recycle'
	//if ($inp.find("calculation").length > 0) {
	//	// an automatic action can be created using an Enhancement - rather than a calculation.
	//	// perhaps the name should be Command or Action.
	//
	//	var $updateButton = jQuery("<img src='css/graphics/icons/cog.png' />").click(updateCalculation);
	//	formEl.appendChild($updateButton.get(0));
	//}

	if (pekoeNode.attributes) {
		// create a fieldset
//		console.log("handling attributes");
		var fs = document.createElement("fieldset"); // a little awkward.
		// this would be better...
//		jQuery(pekoeNode.attributes).each(function (){
//
//		});

		jQuery.map(pekoeNode.attributes, function (a) {
			if ((a.ph) && (a.ph != null)) {
				// maybe this should do a lookup first? test to see if the attribute is of any interest?
				//console.warn("Calling InputMaker on attribute:",a.nodeName);
				gs.Pekoe.merger.InputMaker(fs,a,pekoeNode);
			}
		});

		if (fs.hasChildNodes()) {
			fs.appendChild(formEl);
			fs.pekoeNode = pekoeNode;
			docNode.appendChild(fs);
			formEl = fs; // will this change the object
		} else {
			docNode.appendChild(formEl);
		}

	} else {
		docNode.appendChild(formEl);
	}
	// this should be treated as an enhancement. All of these things should be applied after - BUT, I want to put this BUTTON after the Label, not the field.
	// Technically, my Label is incorrect, because it contains the button. Oh well. Fix it another day.

    // ------------------------  ADD REPLICATE AND DELETE BUTTONS IF REQUIRED ------------------------------------------
	var $finalE = $(formEl); // such a mess.

	// working on the assumption that the only deletable fields are repeating. (but the input checkbox doesn't indicate this)
	// the key issue with "deletable" is that there must be one item left
	// TODO if "singleUse" then it shouldn't be deletable after being saved.
 	 if (options.has('repeating') && !isAttribute) { // Can't replicate an Attribute.
	  	$finalE.addClass("repeating");
	  	// Sortable??? - Would require these elements to be within a container.
	  	// At the same time, change the appearance so they're in a vertical list, and hide the LABEL on all but the first.
	  	// I tried this with CSS - but couldn't get it right. Worth another play sometime - but even nth-of-type isn't helpful because the class is not counted in the type.

		var nn = pekoeNodeName;
		jQuery("<img src='css/graphics/icons/delete.png' class='tool-icon' />")
				.click(function () {
					var hasSib =  gs.Pekoe.oEvaluator.evaluate("count(parent::node()/*[name(.) = '" + nn + "']) > 1", pekoeNode ,null, XPathResult.BOOLEAN_TYPE, null);
					if (!hasSib.booleanValue) {alert("Can't delete the last of these elements"); return; }
					if (confirm("Do you want to delete this element?")) {
						$finalE.hide('slow',function () {
							$finalE.trigger("dirty").remove();
							jQuery(pekoeNode).remove();
						});
					}
				}).appendTo(formEl);

		jQuery("<img src='css/graphics/icons/add.png' class='tool-icon add' />")
			.click(function () {
				mergerUtilities.replicateElement(pekoeNode,formEl);
			}).appendTo(formEl);
	} else if (options.has('deletable') && !options.has('singleUse')) {

		 jQuery("<img src='css/graphics/icons/delete.png' class='tool-icon' />")
			 .click(function () {
				 if (pekoeNode.textContent === '' || confirm("Do you want to delete this element?")) {
					 $finalE.hide('slow',function () {
						 $finalE.trigger("dirty").remove();
						 //TODO  this shouldn't be a straight remove - it should be a "field-choice" added back here.
						 // only problem is - I don't know which 'field-choice' it is.
						 // now it's getting complicated.
						 jQuery(pekoeNode).remove();
					 });
				 }
			 }).appendTo(formEl);
	}

	// --------------------------------------------------------------------------------------  ADD COMMANDS IF AVAILABLE
	var commands = $fieldDef.find('command-button');
	if (commands.length > 0) {
		var wrappedFormInput = gs.inputWrapper(pekoeNode.formElement); // this object will be available to the command-button code.
		// note that pekoeNode.formElement = null for SELECT.
		$fieldDef.find('command-button').each(function () {
			var $command = $(this);
			var cname = $command.find('name').text();
			var cscript = $command.find('javascript').text();
			var cenable = $command.find('enabled-state').text();
			// a command should have a command-button/name /state and /javascript
			if (!cname) { return; } // empty command-buttons will exist.
			// this gets me a clean function with global scope. Somehow that seems better than getting the current scope.
			// Crockford calls this a 'bad part of Javascript'
			var commandFnMaker = new Function("theInput", "return function () {" + cscript + "}"); // 'theInput' is the 'wrappedFormInput'...
			var commandFn = commandFnMaker(wrappedFormInput);
			var b = $('<button class="command-button"></button>')
				.text(cname)
				.on('click',
				function(e){
					e.preventDefault();
					commandFn();
				})
				.addClass(cenable)
				.appendTo($finalE);
		});
		wrappedFormInput._init(); // set the initial visibility of the button.
	}

	// ------------------------------------------------------------------------------------------ end of command-button

	if (pekoeNode.nw) {$finalE.addClass('new-field');} // .nw added by displayTemplateContent if the field or fs is not in the tree.
	if (pekoeNode.defaultField) {$finalE.addClass('default-field');}


	// --------------------------- THE WORK IS DONE. FROM HERE ON ARE THE INDIVIDUAL COMPONENTS ...

	function makeLabelText (n) { // if the node is an attribute, get the parent-Element's name
        if ($fieldDef.find('help')) {}
        if (isAttribute) {
            return parentElement.nodeName + "/@" + n.name;
        } else {
            return n.nodeName;
        }
	}

	function textInput() {
		var $formEl = jQuery("<span class='label'></span>").text(makeLabelText(pekoeNode));
		formEl = $formEl.get(0);
		showDS(formEl,pekoeNode);
	        if (currentValue() === "") {showHelp(formEl,pekoeNode);}
		$formEl.append("<br />")

		var inp = document.createElement("input");
		inp.setAttribute("type","text");
		var pth = $fieldDef.attr("path");
		var uniqueName = pth + "-" + gs.Pekoe.nodeId; // this makes the id unique
		if ((options.has('singleUse') === true) && (currentValue()  !== "")) {
			jQuery(inp).attr("disabled","disabled");
		}
        if (options.has('no-direct-entry') === true) {
            jQuery(inp).attr("disabled","disabled");
        }
		if (options.has("repeating")) {
			inp.setAttribute('title','shift-enter to add another');
		}

		formEl.appendChild(inp);
		inp.setAttribute("name",uniqueName);   // but does the name need to be unique?
		inp.setAttribute("placeholder",$fieldDef.find("example").text());
		inp.setAttribute("size", $inp.attr("size"));

		// set the value as either the pre-existing value, or the default provided by the "inputValue"
		if (currentValue() !== "") {
			// it might need manipulating ??
			var size = $inp.attr("size");
			var discrepancy = size - currentValue().length;
			if ((size> 0) && (size < currentValue().length)) {
				console.log(pekoeNodeName," field too small",discrepancy,size,currentValue())
			}
		} else {
			//var defaultVal = $inp.attr("defaultValue");
			currentValue(defaultValue); // ? defaultVal : "";
		}
		inp.setAttribute("value",currentValue());

		if ($inp.find("lookup").length > 0) {
            //if (isAttribute) console.warn('applying autocompleter to ATTRIBUTE',pekoeNodeName);
            jQuery(inp).addClass("autocompleter");
        }

		inp.onchange = updateTree; // should be a listener - not like this!
		inp.pekoeNode = pekoeNode;
		if (isEnhanced) {
			jQuery(inp).addClass("pekoe-enhancement");
		}
		pekoeNode.formElement = inp;
	 }

	function dateInput() {
		var $f = jQuery("<span class='label'/>")
			.text(makeLabelText(pekoeNode))
			.append("<br />");
		var uniqueName = $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId; // this makes the id unique
		var size = $inp.attr("size"); // this check should be performed elsewhere and should apply to all field types.

		var $i = jQuery("<input type='date' />")
			.attr("id",uniqueName)
			.attr("name",uniqueName)
			.attr("size", size || "10")
			.addClass("date-picker")
			.appendTo($f);

		formEl = $f.get(0);
		try {
		showDS(formEl,pekoeNode);
		} catch (se) {console.error("showDS error");}
		if ((options.has('singleUse') === true) && (currentValue()  !== "")) {$i.attr("disabled","disabled");}

		$i.attr("value",currentValue());
		var inp = $i.get(0);

		inp.onchange = updateTree; // TODO remove this
		inp.pekoeNode = pekoeNode;
		pekoeNode.formElement = inp;

		if (isEnhanced) {
			$i.addClass("pekoe-enhancement"); // current approach to date/time picker
		}
	 }

	function radioInput(  ) {
		formEl = document.createElement("span"); // a span because we need to label the radio-buttons
		formEl.setAttribute("class","label");
		formEl.textContent = makeLabelText(pekoeNode);
		showDS(formEl,pekoeNode);
		formEl.appendChild(document.createElement("br"));
		if ((currentValue() !== '') && (options.has('singleUse'))) {
			var value = document.createTextNode(currentValue());
			formEl.appendChild((value));
		} else {

			var vals = jQuery($inp.find("list")[0]).text().split(/\s*\n\s*/); // separated by line-breaks. possibly CRLF
			var inpName = $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId++;
			// the values can be simple strings or colon separated value:name
			jQuery.map(vals, function(valueColonName) {
				var split = valueColonName.split(":");
				var n = (split.length === 2) ? split[1] : split[0];
				var v = split[0];
				var l = document.createElement("label");
				var item = document.createTextNode(n);
				var inp = document.createElement("input");
				inp.setAttribute("type","radio");

				inp.setAttribute("name",inpName);
	//			inp.setAttribute("id",inpName + "-" + gs.Pekoe.nodeId++); // doesn't matter if the name is different to the id
				inp.setAttribute("value", v);
				if (v === currentValue()) { inp.setAttribute("checked","checked");}
				inp.onchange = updateTree;
				inp.pekoeNode = pekoeNode;
				l.appendChild(inp);
				l.appendChild(item);
				formEl.appendChild(l);
			});
		}
		pekoeNode.formElement = null; //TODO (2012-01-14: work out why null here?) probably need to create a getter/setter for radios and selects
	 }

	function checkboxInput(  ) { formEl = document.createElement("label");
		formEl.textContent = makeLabelText(pekoeNode);
		showDS(formEl,pekoeNode);
			var $i = jQuery("<input type='checkbox' value='1' />");
			var inp = $i.get(0);
			var uniqueName = $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId; // this makes the id unique
			if ((options.has('singleUse') === true) && (currentValue()  !== "")) $i.attr('disabled',true);

			$i.attr("name", uniqueName);   // but does the name need to be unique?
			if (currentValue() === "1") {
				$i.attr("checked",""); // how does this work?
			}
			$i.on("change", function () {
				var $this = jQuery(this); // This looks like it could get mixed up TODO - this needs testing URGENT.
				if (currentValue() === "1") {
					currentValue("")
				} else {
					currentValue("1");
				}
				$this.trigger("dirty");
			});
			inp.pekoeNode = pekoeNode;
			pekoeNode.formElement = inp;
			formEl.appendChild(inp);
	 }

	function multiCheckBox() {
		var $formEl = jQuery("<span class='label' />").text(makeLabelText(pekoeNode));
		formEl = $formEl.get(0);


		showDS(formEl,pekoeNode);
		jQuery("<br />").appendTo($formEl);
		var vals = jQuery($inp.find("list")[0]).text().split(/\s*\n\s*/); // separated by line-breaks. possibly CRLF
		var inpName = $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId++;
		var currentValues = currentValue().split(/\s*\n\s*/);
		jQuery.map(vals,function(n) {
			var $l = jQuery("<label />").text(n);
			var $i = jQuery("<input type='checkbox' />").attr('name',inpName);
			$i.attr("value", n);
			if (jQuery.inArray(n,currentValues) !== -1) { $i.attr("checked","");} // turn it on
//	TODO THIS IS FAULTY
			$i.on("change", function () {
				// the values are the same as the labels.
				// they are separated by line-breaks.
				//
				var $this = jQuery(this); // get handle on the checkbox that has changed
				var vals = currentValue().split(/\s*\n\s*/); // Values may contain spaces. This returns an array - possibly containing an empty string
//				// NOTE the return value from splice is the value removed from the array - not the (modified) array itself
				var isSet = jQuery.inArray($this.val(), vals);
				if (isSet === -1) {
					vals.push(n);
					currentValue(vals.join("\n"));
				}
				else {
					vals.splice(isSet, 1)
					currentValue(vals.join("\n"));
				}
				$this.trigger("dirty");
			});
			$i.get(0).pekoeNode = pekoeNode; // we're attaching the same pekoenode to each checkbox
			$formEl.append($l.append($i));
		});
		pekoeNode.formElement = null; // probably need to create a getter/setter for radios and selects
	}

	function textareaInput(  ) {
		if (options.has("htmledit")) { //TODO  HUH? What does this do?

			formEl = jQuery("<div class='read-only'></div>").get();

			jQuery(pekoeNode).children().each(function () {
				formEl.appendChild(this);
			});
		}
		else if ((options.has('singleUse') === true) && (currentValue()  !== "")) {

            // would be nice to gather similar children - perhaps at a higher level
            formEl = jQuery("<div class='read-only'/>");
            if (!isAttribute){
                var dateStamp = pekoeNode.getAttribute("date-stamp");
                var timeStamp = pekoeNode.getAttribute("time-stamp");
                var dtString = (dateStamp !== null) ? "(" + Date.fromISO(dateStamp).toAustDate() + ((timeStamp != "") ? (" " + timeStamp) : "") + ") " : "";
                jQuery("<span class='dt-stamp/>").text(dtString).appendTo(formEl);
            }
            jQuery("<span/>").html(pekoeNode);
		} else {
			formEl = document.createElement("label");
			formEl.textContent = makeLabelText(pekoeNode);

			showDS(formEl,pekoeNode);
			formEl.appendChild(document.createElement("br"));
			var inp = document.createElement("textarea");
			formEl.appendChild(inp);
			inp.setAttribute("name", $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId);
			inp.setAttribute("id",  "te" + "-" + gs.Pekoe.nodeId);
			/*
				Rows and cols. Size is cols. e.g. 60. A line break will possibly happen at 59 chars.
				For each line, count the chars. Divide by 60. Add to the total. Use this as the number of rows
			 */

			var rows = ($inp.attr("rows"))  ? $inp.attr("rows") : 3;
			var size = ($inp.attr("size")) ? $inp.attr("size") : 60;
			var currentText = currentValue();


			inp.textContent = currentText; // this has been extracted from the existing node or the default value
			if (currentText.length > 0) {
				var lc = 0;
				var lines = currentText.split('\r');
				for (var i = 0; i < lines.length; i++) {
					lc += Math.ceil(lines[i].length / size);
				}
			}

			//console.log('size',size,'rows',rows,'lc',lc);
			if (!rows || lc > rows) { rows = lc;}
			inp.setAttribute("rows",rows);
			inp.setAttribute("cols",size);
			inp.onchange = updateTree;
			inp.pekoeNode = pekoeNode;

		}
		pekoeNode.formElement = inp;
	 }

	 function richTextInput(  ) {
         // CKEDITOR is applied inline. See Utility.js - line 148 or thereabouts
         var $formEl = jQuery("<div class='rt-box' ></div>"); // Field wrapper
         var $display = jQuery("<div class='rte'></div>") // display the Rich Text Content
             .attr("id","rte-"+ gs.Pekoe.nodeId)
             .html(jQuery(pekoeNode.childNodes).clone()); // must use clone otherwise we lose the original elements - so all children will be lost when doc is saved.
         // make editable if single use is false OR text is empty
         if (!options.has('singleUse') || ($display.text() === "")) {
             $display.attr("contenteditable","true");
         }
         jQuery("<label class='rte-button'></label>") // make the field LABEL be the active element
             .text(pekoeNodeName)
             .appendTo($formEl);
         $formEl.append($display);
         $display.data("pekoeNode",pekoeNode);
         formEl = $formEl.get(0);
	 }

	// TODO - make input LOOKUP work here.
	function selectInput(  ) {
		formEl = document.createElement("label");
		formEl.textContent = makeLabelText(pekoeNode);
		showDS(formEl,pekoeNode);
		formEl.appendChild(document.createElement("br"));
		var select = document.createElement("select");
		var uniqueName =  $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId;
		select.setAttribute("name",uniqueName);
		select.onchange = updateTree;
		select.pekoeNode = pekoeNode;
		formEl.appendChild(select);
		var selectList = jQuery($inp.find("list")[0]).text();
		if ((currentValue() !== "") && (selectList.indexOf(currentValue()) == -1)){selectList += "\n"+currentValue();} // make sure list contains the value
		var vals = selectList.split(/\s*\n\s*/); // separated by line-breaks. possibly CRLF

		jQuery.map(vals, function(n) {
			var inp = document.createElement("option");
			inp.setAttribute("value", n);
			inp.textContent=n;
			if (n == currentValue()) { inp.setAttribute("selected","selected");}
			select.appendChild(inp);
		});
		pekoeNode.formElement = $(select); // why?
		if (isEnhanced) {
			$(select).addClass("pekoe-enhancement");
		}
	 }


	// TODO: lookup for newly added field not working
	// TODO: field-choice must not repeat unless asked - hide it.
	// TODO: field-choice with a single option should be a button

	function fieldChoiceInput(  ) {
		formEl = document.createElement("label");
		formEl.textContent = makeLabelText(pekoeNode);
		formEl.appendChild(document.createElement("br"));
		var select = document.createElement("select");
		var uniqueName =  $fieldDef.attr("path") + "-" + gs.Pekoe.nodeId;
		select.setAttribute("name",uniqueName);
		// TODO remove this field choice if it is not repeating.
		// e.g. output-or-xquery - only want one xquery and NO output
		// but if output is chosen, it is a repeating fragment.
		// only problem with this is there's no going back. No UNDO.
		select.onchange = function (e) {
			//jQuery.statusMessage("Choose field " + e.target.value);
			if (e.target.value === '') { // TODO incorporate check for field definition before inserting.
				console.warn('NO SUITABLE FIELD NAME for fieldChoice insertion');
				return;
			}

			// NOT A SOLUTION YET:
			//if (!options.has('repeating')) { $(select).hide()}
			// There's no obvious way to SHOW this element if you decide to change your mind.
			// PERHAPS it should be disabled? Based on a TEST?
			// Perhaps IT should have the "REMOVE XXX" after adding XXX?
			// The DELETE button should have ON-click -> show this

			var pkn = pekoeNode;
			var od = pkn.ownerDocument;
			var newNodeName = e.target.value;
			e.target.value = ""; // reset


			var de = od.documentElement;
			var myPath = function(n) {
				if (n === de) { return '/' + n.nodeName; }
				else return myPath(n.parentNode) + '/' + n.nodeName;
			}

			var doctype = de.nodeName;
			var path = myPath(pkn.parentNode) + '/' + newNodeName;
			//console.log('looking for path ',path);
			var schema = gs.schemas[doctype];
			var field = schema.getFieldDefByPath(path);
			// now - check the options to see whether to replace this choice-element, or insert-before.
			// I have created the delete buttons - just need to work out how to replace the field with _this_ field-choice again.
			//console.log('REPLACE CHOICE?',options.has('only-one-of'));
			var fragment = schema.getTemplateFragment('/fragments/' + newNodeName);
			if (fragment) { // if there is a fragment for this, then use it.
				// too much of this is replicating the behaviour of other functions like 'addMe'

				var nn = od.importNode(fragment,true);
				nn.pekoeEmpty = true; // it's new so its empty
				pkn.parentNode.insertBefore(nn,pkn);
				nn.ph = field;
				// make a fragment
				gs.Pekoe.merger.Utility.enhanceSubtree(schema, nn, newNodeName);
				nn.toForm = gs.Pekoe.fragmentNodeForm;
				var newFS = nn.toForm();

				// if options only-one-of then the select must go away.
				// my naming is wrong.
				// the options are
				// a sequence optionally containing...
				// only-one-of-these-options
				// as many as you like
				// now the 'as many' option is easy because we simply enable the field to have a plus button
				// so the field itself is repeating.
				// the one-of-these option means removing the SELECT
				// somehow, I think that the OPTION should be removed or disabled. but I'm not sure WHEN or WHY or how to SAY IT.
				if (options.has("only-one-of")) {
					//console.log('ONLY ONE OF FOR THIS ELEMENT',path);
					jQuery("<img src='css/graphics/icons/delete.png' class='tool-icon' />")
						.click(function () {
							if (confirm("Do you want to delete this element?")) {
								jQuery(newFS).hide('slow',function () {
									jQuery(newFS).trigger("dirty").remove();
									//TODO  this shouldn't be a straight remove - it should be a "field-choice" added back here.
									// only problem is - I don't know which 'field-choice' it is.
									// now it's getting complicated.
									jQuery(nn).remove();
								});
							}
						}).appendTo(newFS);
				}
				jQuery(newFS).hide();
				// another way to handle the post-rendering enhancements is to blindly apply them and let each one work out if it's relevent
				//jQuery('input[type=date]',newFS).datepicker({dateFormat:'yy-mm-dd'});
				// AUTOCOMPLETE LOOKUP ------------------------------------------- AUTOCOMPLETE ON FRAGMENT LOOKUP -------------
				// Apply the pekoeLookup widget to any input with class .fragment-lookup or .autocompleter
				//if ($(newFS).hasClass('fragment-lookup')) {$(newFS).pekoeLookup();}


				var parentN = formEl.parentNode;
				var parentN = formEl.parentNode.insertBefore(newFS,formEl);
				//parentN.appendChild(newFS);
				gs.Pekoe.merger.Utility.applyEnhancements(newFS); // I have the context wrong.
				jQuery(newFS).show('slow');

			} else if (field !== "") {
				var nn = od.createElement(newNodeName);
				pkn.parentNode.insertBefore(nn,pkn);
				nn.ph = field;
				// make a simple input
				var newFS = document.createDocumentFragment();
				//console.log('fieldChoiceInput calling InputMaker for',nn.nodeName);
				var x = gs.Pekoe.merger.InputMaker(newFS,nn);
				console.log('INPT MAKER RETURNED',x);
				// created a fragment - the contents.
				var el = newFS.firstChild;
				jQuery(el).hide();
				// if the element is a repeater, then insert before it. Otherwise replace it.
				//sib = formEl.nextSibling;
				var parentN = formEl.parentNode.insertBefore(newFS,formEl);
				//jQuery('input[type=date]').datepicker({dateFormat:'yy-mm-dd'});
				//// AUTOCOMPLETE LOOKUP ------------------------------------------- AUTOCOMPLETE ON FRAGMENT LOOKUP -------------
				//// Apply the pekoeLookup widget to any input with class .fragment-lookup or .autocompleter
				//jQuery(".fragment-lookup, .autocompleter", mform).pekoeLookup();
				jQuery(el).show('slow');

				// now need to check if there are any enhancements.
				// problem with the
				//if (jQuery(el).find('input').is('.autocompleter')) { jQuery(el).find('input').pekoeLookup(); } // any other enhancements that should be applied?
				//jQuery(el).find('.rte').each(applyRTE);
			}
			else  {
				console.warn('Neither field nor fragment for',path);
				return;
			}
		};
		select.pekoeNode = pekoeNode;
		formEl.appendChild(select);
		var selectList = jQuery($inp.find("list")[0]).text();
		if ((currentValue() !== "") && (selectList.indexOf(currentValue()) == -1)){selectList += "\n"+currentValue();} // make sure list contains the value
		var vals = selectList.split(/\s*\n\s*/); // separated by line-breaks. possibly CRLF


		jQuery.map(vals, function(n) {
			var inp = document.createElement("option");
			inp.setAttribute("value", n);
			inp.textContent=n;
			if (n == currentValue()) { inp.setAttribute("selected","selected");}
			select.appendChild(inp);
		});
		pekoeNode.formElement = null;
	}

	function register(fnName, fn) {elementTypes[fnName] = fn;}
	function constructElement(fnName) {
		if (elementTypes[fnName]){
			return elementTypes[fnName];
		} else {
			console.warn("No Element type ",fnName, " for ", pekoeNodeName); // relates to previous warning about missing field/input/@type
			return elementTypes["text"];
		}
	}




};
// ---------------------------------------------------------- END of elementMaker -------------------------------------------------------------
