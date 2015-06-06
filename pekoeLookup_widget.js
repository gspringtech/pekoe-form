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

(function ($) {
	"use strict"; // EC5 Directive.
	// private methods...
//	var escapeRegex = function( value ) { // If I want to use regex here, I'll have to fix all the queries on the server so that they can handle regex chars in the query
//		//
//		return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&"); // these are all the RegExp metachars.
//	};


	var _pekoeXPathResult = function (pEl, xpath) { // used only to search for params for the script. Should return a string
        var result = null;
        try {
            result = gs.Pekoe.evaluateXPath(pEl,xpath);
        } catch (e) {console.warn('XPath', xpath, 'failed on',pEl);}
        var r = result[0];
        // the DBA may not have asked for data(@param) or Element/string(.)
        if (r instanceof Attr) {
            r = r.value;
        } else if (r instanceof Element) {
            r = r.textContent;
        }
        return r;
	};
	

	var _prepareAjaxDataFn = function ($params, pekoeNode, script, lookupType) {        //TODO - handle empty script and empty param (or maybe containing whitespace)
        // example:
        // for $n in collection("/db/pekoe/files")/schema[@for eq '$1']//(field[@path eq '$2'],fragment[@name eq (tokenize('$2','/')[last()]) ])/output/@name[. ne '']/string(.) order by $n return $n

		// create a slightly curried version of the script - just want the term handled.
		// check the script for $0. If not there, the script is fixed and ONE-SHOT! (But we already know that.)
		// PEKOE-TODO: handle Lookup/@type == javascript. I think Javascript may be for "calculation"s only.

		var xpath_context = pekoeNode.myElement || pekoeNode; // Ensure context is an Element. Attr is NOT a NODE.

		$params.each(function (index){ // the explicit params only need to be evaluated once
			var p = new RegExp("\\$" + (index + 1), "g"); // 0-based index - but params start at $1
			var param = $(this).text().trim();
            if (param === '') return;
			var val = _pekoeXPathResult(xpath_context, param); // find the value using an XPath with the pekoeNode as context
			script = script.replace(p, val);   // replacing the $1, $2 etc in the script above
		});

		// In the url-params case, there is NO query.
		var data = {"_howmany": 100 ,"_wrap": "yes"}; // When is _wrap=no??
		// simple closure/curry. Not hugely useful.
		if (lookupType === "javascript") {
			// this is to lookup stuff locally - like fragment/@names to use in a fragment-ref.
			// TODO make this work.
		} else if (lookupType === "url-params") {
			//for each use of $i in the script, replace it with a value
			// Oh tricky dicky. I'm going to make data["schoolname"] = "$0". So how do I "replace term" 
			//split the script on &
//			data["_wrap"] = "no";
			var parts = script.split("&"); // this seems to work! (I thought it might be affected by the entity &)
			// add the params to the data
			var inputParamName = null;
			$.each(parts, function() {
				
				var nameValue = this.split("=");
				if (nameValue[1] === "$0") {inputParamName = nameValue[0];}
				data[nameValue[0]] = nameValue[1];
			});
			// return a function of term for url-params: ----------
			return function (term) {
				data[inputParamName] = term; //escapeRegex(term);
				return data;
			};
			
		} else if (script.indexOf("$0") === -1) { 
			data["_query"] = script;
			return function () { return data; } // doesn't use the term (must be "one shot")
		} else {
			return function (term) {
				 data["_query"] = script.replace("$0",term); //escapeRegex(term));
				 return data;
			 }
		}
	}; // _prepareAjaxDataFn
	
	var _prepareAjaxPath = function (path) {
		var p = path || "";
		return "/exist/pekoe-files/" + p; // any other testing needed here?
	};
	
	var _processAjaxResponse = function (xmlData) {
		// handle xml structured response: return either an array of objects or strings
		// assuming that the response is wrapped - but may not be.
		return $( "exist\\:result,result", xmlData ).children().map(function () {
			var $this = $(this);
			var hasChildren = $this.children().length > 0; // this works.			
			var item = {hasChildren:hasChildren};
			if (hasChildren) {
				// convert complex children into tagname:value[,...]
				item.desc = $(this).children().first().siblings().map(function () {
					return this.tagName + ": " + $(this).text();
				}).get().join(', ');
				
				item.value = $this.children().first().text();
				item.data = this;
			} else {
				item.value = $this.text();

				if ($this.attr("description")) {item.desc = $this.attr("description");} 
			}

			return item;
		}).get(); // As the return value is a jQuery-wrapped array, it's very common to get() the returned object to work with a basic array.	
	}; // _processResponse
	
	var _renderItem = function( ul, item ) { // CUSTOM display of XML structured results.
        var $li = $('<li></li>');
		if (!item.desc) {
			$li.attr( "item.autocomplete", item ).append( "<a>" + item.value + "</a>").appendTo( ul );
		} else {
			$li.data( "item.autocomplete", item )
				.append( "<a>" + item.value + "<br/><span class='item-description'>" + item.desc + "</span></a>" )
				.appendTo( ul );
		}
        return $li;
	};
	

	var _complexInsertion = function (item,pkn,formEl,$applyTo) {  // ui.item is the chosen object containing {value, data}

		var doc = pkn.ownerDocument;
		var schema = gs.schemas[doc.documentElement.nodeName];

		if (!item.hasChildren) {  // simple list
			// if the lookup is applied to an attribute, then this is wrong. OR it was always wrong
			$applyTo.val(item.value.trim()); // and that's it!
			console.log('triggering change on',$applyTo); // this is the fieldset, not the element!
			$applyTo.trigger("change");
			$applyTo.trigger("dirty");

		} else { 
			var e = item.data; // assuming complex
			
			// This is a reasonable assumption. If this element is not a fragment, check its parent. 
			// However, if the parent is not a fragment, then it's probably the root. (!!Possibly an element, if the pkn is an attribute.)
			// SO, if it's the root, then what do I do?
			// First, check for root
			// then, iterate over the children, calling the replace.
			// NOTE: this will NOT fix the Programme-sets-school/fee problem. 
			// That's another problem. 
			// In fact, the solution to that problem is going to be quite different. 
//			SO GO BACK TO BASICS: A REPLACE ON THE ROOT ELEMENT SHOULD NOT BE ALLOWED, AND SHOULD THROW AN ERROR.
			var fragmentNode = pkn;
			if (!formEl.is('fieldset')) {				
				fragmentNode = pkn.parentNode;
				formEl = formEl.parent("fieldset");
			}
			if (fragmentNode.parentNode === pkn.ownerDocument) {
				$.statusMessage("Parent is document Root element. Cannot use a Complex result here.");
				return false;
			}

			var $frag = $(e); 
			if ($frag.children().length > 0) {
				try {
					var nodeToFind = e.nodeName; // e.g. entity or school or school-booking
					doc.importNode(e,true); // no good if this is a root element (although the import will work - import doesn't put the new node into the tree, just the document).
					$(fragmentNode).replaceWith(e); // if this is the document element, we've just busted everything.
					// This is NOT a MERGE. This is a replacement of a fragment followed by a check to ensure that any child elements, specified by the schema AND the template, are included.
					
					e.ph = fragmentNode.ph; 
					var fragment = $(schema.fragmentsTree).find(nodeToFind).get(0); 
					var nn = gs.Pekoe.merger.Utility.mirrorNodes(fragmentNode,e); // new node? this should still be the 
					nn.ph = fragmentNode.ph;
					nn.toForm = fragmentNode.toForm; // so it can be 'rendered'
					gs.Pekoe.merger.Utility.enhanceSubtree(schema, nn, nodeToFind); // Bloody BRILLIANT.
				
			    	var newForm = nn.toForm();
			    	formEl.replaceWith(newForm);
			    	$(newForm).pekoeLookup(); // reapply this
			    	
			    } catch (e) {
			    	console.error(e);
			    } 
			}
		} 			
	};
	
	$.fn.pekoeLookup = function () {
		// THIS is the jQuery object we've been attached to. It might be one DOM element, or multiple:
		// any creation methods could go here

		this.each(function () {
            //console.log('got lookup on',this);
            var $element = $(this); // an input or fieldset ("formEl")
            var pekoeNode = this.pekoeNode; // this is my xml element OR MAYBE NOT - maybe it's an ATTRIBUTE - which IS NOT A NODE anymore. which means pekoeNode.nodeType IS NO GOOD.

            var isAttribute = this.pekoeNode.myParent !== undefined; // I have attached a myParent property to the pekoeNode if it's an attribute.

			/*
			 field (@path)
			 field/input @source = lookup | calculation | list; // ... this is where I need optional fragments
			 field/input/lookup 
			 	@type = xquery | javascript | url-params; 
			 	@one-shot = 1 | 0 (ajax request once only); 
			 	@path = path-to-resource or query;
			 	@applies-to = subfield;
			 	@allow-other-values = 1 | 0 (allow user to enter text)
			 field/input/lookup/script
			 
			 
			 $0 is "this" input. 
			 want to filter one-shot results with "this"
			 */
			//
			var $ph = $(pekoeNode.ph); // the field definition
			
			var $lookup = $ph.find("lookup"); // Shouldn't be here otherwise
			var selector = $lookup.attr("applies-to"); // if empty, it applies to the current input only (??).
			// TODO - Is this applicable?
			var isRecyclable = $lookup.attr("recycle") == "1"; // show the recycle button - it will be "this" link with an action='recycle'
			// recycle might also be added to a stack which can be sent if the job is not saved
			var script = $lookup.find("script").text();
			var oneShot = ($lookup.attr("one-shot") == '1') || (script.indexOf("$0") == -1); // repeat Ajax request each time or once only

			var qType = $lookup.attr("type"); // xquery | javascript | url-params;
			var allowUserInput = $lookup.attr("allow-other-values") == 1; // Allows user-input as result (rather than selected result)
			var path = $lookup.attr("path"); // path in /db/pekoe/ to the resource. Query will be appended to path

			var usesInput = script.indexOf("$0") !== -1; //$0 is "this" input.val();
			var $params = $lookup.find("param"); // :not(:empty)"); // any param other than $element.val() will be evaluated once at the start. The user can't type into another field
			// while using this - so there's no point updating.
			var $applyTo = (selector) ? $element.find("[name^='" + selector + "']") : $element;
            //console.log('lookup found $lookup',$lookup,'selector',selector,'$applyTo',$applyTo);
			$applyTo.addClass('fragment-autocompleter').on("focus", function () {
				var valueChosen = false;
                // "oneShot" means there's a fixed list (not too big) to retrieve from the server. Alternative is to lookup after each keystroke.
				if (oneShot){ // Get the data and then apply Autocomplete
					// probably should utilise localStorage to cache results
					$applyTo.addClass('ui-autocomplete-loading');
					// construct the path and data
					var queryData = _prepareAjaxDataFn($params, pekoeNode, script, qType)(); // get and call this one-shot to return {_query: ,_howmany: }
					var fullpath = _prepareAjaxPath(path);
					//console.log("queryData", queryData);
					// TODO why is there no METHOD ?
					$.ajax({
						url: fullpath,
						data: queryData, 
						success: function (resp) {
							var data = _processAjaxResponse(resp); // construct a useful array of Objects or Strings
							// AUTOCOMPLETE One-shot
							$applyTo.autocomplete({
								source: data,
								autoFocus: true,
								minLength: 0,
								select: function (event, ui) {
									valueChosen = true;
									_complexInsertion(ui.item, pekoeNode, $element, $applyTo);
								},
								close : function (event,ui) {
								}
							}).data( "ui-autocomplete" )._renderItem = _renderItem;
						}
					});

				} else { // Apply Autocomplete with a Custom SOURCE function which will make Ajax requests in response to user's keyboard-input.
					// AUTOCOMPLETE Repeating
					var queryData = _prepareAjaxDataFn($params, pekoeNode, script, qType); // get and call this one-shot to return {_query: ,_howmany: }
					var fullpath = _prepareAjaxPath(path);
					var previousValue = $applyTo.val();
					$applyTo.autocomplete({
						source: function (request, response) {
							// here's the Ajax lookup:
							$.ajax({
								url:fullpath,
								data : queryData(request.term),
								success: function (r) {
									response(_processAjaxResponse(r));
								},
								error : function () {
									response("There was an error.");
								}
							});
						},
						
						select: function (event, ui) {
							_complexInsertion(ui.item, pekoeNode, $element);
						},
						change: function( event, ui ) { // from the Combobox example - prevent entry if not from list...
							if ( !ui.item ) { // user has escaped or something to close the box without choosing something from the list
								$applyTo.val(previousValue);
							}
						}						
					}).data( "ui-autocomplete" )._renderItem = _renderItem;
				}
			});	


					// this is from the jQuery.ui autocomplete 
				/*
				 * escaping any Regex metachars within the search term (not expecting them - but this COULD be a USER Preference)
					escapeRegex: function( value ) {
						return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&"); // these are all the RegExp metachars.
					},
					 the filter function creates a RegExp so that the term can be matched (i) against the array using grep to return a filtered array.
					 the .test is applied to the first of (for structured results) .label || .value || value   (the last is for a string array.) NICE 
					filter: function(array, term) {
					var matcher = new RegExp( $.ui.autocomplete.escapeRegex(term), "i" );
					// good example of handling the array of objects or strings.
					return $.grep( array, function(value) { 				    
					    return matcher.test( value.label || value.value || value );
					});
					}
				*/

	
			
		}); // $(this).each - the loop around $().autocomplete
	};      // pekoeLookup
})(jQuery);		