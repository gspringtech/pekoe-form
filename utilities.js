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


// Date extensions: ------------------------------------------------------------------------------------
Date.fromISO = function (isoDateString) {
	// not quite right. 
	// might have a timezone: 2011-06-02+09:30
	isoDateString = isoDateString.replace(/\+.*$/,""); // remove the +... - can ignore -offsets
	var dItems = isoDateString.split('-');
	if (dItems.length >= 3) {
		return new Date(dItems[0],dItems[1]-1,dItems[2]);
	}else {
		return null;
	}
}; 
Date.fromISODateTime = function (isod) {
	// 2009-05-04T07:16:32.829+09:30
	// 2009-07-24T10:17:46+09:30 doesn't have millis - so use..(.....)?
	var dre = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d*)?(.)(\d{2}):(\d{2})$/;
	if (dre.test(isod)) {
		var tzop = (RegExp.$8 == "+") ? "-" : "+"; // adjust 
		var tzh = RegExp.$9;
		var tzm = RegExp.lastParen; // can't get "$10"
		var tzo = ((tzh * 60) + (1 * tzm)) * 60 * 1000;
		var unadjustedMillis = Date.UTC(RegExp.$1,RegExp.$2-1,RegExp.$3,RegExp.$4,RegExp.$5,RegExp.$6,RegExp.$7);
		
		var d = new Date(eval(unadjustedMillis + tzop + tzo));
		return d;
	}
	console.warn("fromISODateTime: Bad dateTime",isod);
	return null;
};

Date.prototype.toISODate = function () {
	
	//"2007-08-08" Padding is (now) not such a drag 2009-03-26
	function pad(n,w) {
		var padre = new RegExp(".*(.{" + w + "})");
		return ("0000" + n).replace(padre, "$1");
	}
	var pad0  = function (n) { return pad(n,2);};

	var paddedMonth = pad0(this.getMonth() +1);
	var paddedDay = pad0(this.getDate());
	var ds = [this.getFullYear(), paddedMonth, paddedDay].join('-');
	return ds;
};

Date.prototype.toISODateTime = function () {
	// 2009-03-26T17:18:51.616+10:30
	// XML Schema uses Timezone = LocalTime - GMT;
	// Javascript uses Timezone = GMT - LocalTime; 
	// a pox upon them

	function pad(n,w) {
		var padre = new RegExp(".*(.{" + w + "})");
		return ("0000" + n).replace(padre, "$1");
	}
	
	var pad0  = function (n) { return pad(n,2);};
	var pad00 = function (n) { return pad(n,3);};

	var ph = pad0(this.getHours()); 
	var pm = pad0(this.getMinutes());
	
	var ps = pad0(this.getSeconds());
	var pms = pad00(this.getMilliseconds());
	var tzH = Math.round(this.getTimezoneOffset()/60);
	var tzM = Math.abs(this.getTimezoneOffset() % 60);
	var ptzH = pad0(Math.abs(tzH));
	var ptzM = pad0(tzM);
	return this.toISODate() + "T" + ph + ":" + pm + ":" + ps + "." + pms + ((tzH > 0) ? "-" : "+") + ptzH + ":" + ptzM; 
}

Date.prototype.toAustDate = function (separator) {
		// 15-08-2007
	if (this.getTime() > 0) {
		separator = separator ? separator : "-";
		var m = this.getMonth() +1;
		var paddedMonth = (m < 10) ? "0" + m : m;
		var d = this.getDate();
		var paddedDay = (d < 10) ? "0" + d : d;
		var ds = [paddedDay, paddedMonth,this.getFullYear()].join(separator);
		return ds;
	} 
	return ""; 
};


	
	

var gs;
if (!gs) { gs = {}; }

// this is an object. It's going to be used to add methods and members to a DOM Node 
gs.Utility = function () {
	return {
	getArgs : function () {
		// (this version) from JavaScript The Definitive Edition (5th ed) by David Flanagan
		var args = {};
	  	var query = location.search.substring(1);     // Get query string
	    var pairs = query.split("&");                 // Break at ampersand
//	    console.log("getting args");
	    for(var i = 0; i < pairs.length; i++) {
	        var pos = pairs[i].indexOf('=');          // Look for "name=value"
	        if (pos == -1) {continue;}                 // If not found, skip
	        var argname = pairs[i].substring(0,pos);  // Extract the name
	        var value = pairs[i].substring(pos+1);    // Extract the value
	        value = decodeURIComponent(value);        // Decode it, if needed
	        args[argname] = value;                    // Store as a property
	    }
	    return args;             
	},
	

	// Based on a function from Joe Hewitt's Firebug.

	getElementTreeXPath : function (element) {
//        console.log('getElementTreeXPath called on',element);
	    var paths = [];
        // No longer works with attributes. Attributes should not be passed to this function
//	    if (element && element.nodeType === Node.ATTRIBUTE_NODE) {
//	    	paths.push("@" + element.nodeName); // nodename for attribute?
//	    	element = element.ownerElement;
//	    }

	    for (; element && element.nodeType == Node.ELEMENT_NODE; element = element.parentNode) {
            var index = 0;
            for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.localName == element.localName) {
                    ++index;
                }
            }
            var tagName = element.localName;
            var pathIndex = "[" + (index + 1) + "]";
            paths.push(tagName + pathIndex);
        }
	    return paths.length ? "/" + paths.reverse().join("/") : null;
	}

	/*
	
	findfiles : function (f) { // called by the Get button in #tx-trees #other-data
//		var searchField = $('other-tx-path');
		var s = gs.Pekoe.menus.ips_otherTree.otherTxSearchStr;
//		var s = searchField.value;
		console.log('search value',s);
		var orderBy = ""; //   (this.list.orderBy !== "") ? "orderBy=" + this.list.orderBy : "";
		var filesource = "filesource=";
		var that = this;
		var parsedSearchString = s.match(/(.*?):(.*)/); // split into [the_whole_match, the_action, the_str]
		if (!parsedSearchString) {return;} 
//		var [t, action, s] = parsedSearchString; // This is not an error - it's just JSEclipse being difficult. This is a destructured assignment.
		var t,action,ss = null;
		t = parsedSearchString[0];
		action = parsedSearchString[1];
		ss = parsedSearchString[2];
		
//		action = "action=".concat(action); // the actions are still supposed to be "quick-find", xpath, tlist etc. So this is WRONG
//		switch (s) {
//			case (s.indexOf('xpath:') == 0):
//				s = s.substring(6);
//				action = "action=xpath";
//				break;
//			case (s.indexOf('text:') == 0):
//				s = s.substring(5);
//				action = "action=quickfind";
//				break;
//		}
		if (action == "xpath") {
			
			action = "action=xpath";
		} else if (action == "fragments") {
			var treeDisplay = new gs.Pekoe.TreeDisplay();
			treeDisplay.init('other-tx', gs.Pekoe.merger.Utility.getFragmentsTree(),"Fragments Tree",null);
			treeDisplay.renderIt();

			$('other-tx').select("li").each(function (n) {
				new Drag(n,{classname : 'drag', 
					caption   : n.pekoeNode.nodeName, 
					mouseOver: null //function () {console.log('moving');}
					 }); //  self:true -- DRAG whole thing !!!

			});			
			return; // !!!!
			
		} else if (action == "schema") {
			var treeDisplay = new gs.Pekoe.TreeDisplay();
			treeDisplay.init('other-tx', gs.Pekoe.merger.Utility.getFragmentsTree(),"Schema",null);
			treeDisplay.renderIt();

			$('other-tx').select("li").each(function (n) {
				new Drag(n,{classname : 'drag', 
					caption   : n.pekoeNode.nodeName, 
					mouseOver: null //function () {console.log('moving');}
					 }); //  self:true -- DRAG whole thing !!!

			});			
			return; // !!!!
			
		} else if (action === "previous versions") {
			// load the last 10 versions. Crap. 
			
		} else 
		
		{
			
			action = "action=quickfind";
		}

		var offset = "offset=0";
		var size = "size=10";
		var template = "";
		var search = "str=" + encodeURIComponent(ss);
		var generalparams = [action,template,orderBy,filesource,search];
		var positionalparams = [offset,size];
		var params = generalparams.concat(positionalparams).join('&');
		console.log("Params",params); 
		var ajr = new Ajax.Request('job-listing.xql',  
			{	method: 'GET',
				parameters: params,
				onSuccess: function (t) {
//					<files count="86" fields="">
//  <file path="" display-name="TXO-.xml"/>
//  <file path="" display-name="TXO-2007-08-01-1.xml"/>
//  <file path="" display-name="TXO-T4538.xml"/>
//</files>
					var ul = document.createElement('ul');
					var xText = new XML(t.responseText); 
					for each (file in xText.file){
						var li = document.createElement('li');
						var a = document.createElement('a');
						a.setAttribute('href',"javascript:gs.Utility.getFormattedTx('"+file.@path.toString() +"','other-tx');");
						a.textContent = file.@["display-name"];
						li.appendChild(a);
						ul.appendChild(li);
//        				print(entry.name+":"+entry.phoneNumber);     
        			}
        			
					$('other-tx').textContent = "";
					$('other-tx').appendChild(ul);
							}
			});
		
	},
	
	// I want to generalise this function. 
	// I want the results List of any search to contain links to the Items
	// The links must be javascript calls to the same ajax function - so that
	// the result can be displayed in the same spot. 
	// OR we pass in the desired linking function
	// OR we format here. (which sounds best). 
	
	getFormattedTx : function (f, resultsBlockId,titleBlock) {  // the href action from the other-data list (above)
		var href = "/exist/rest/db/pekoe/files/" + f;
	
		var ajr = new Ajax.Request(href, 
			{	method: 'GET',
				
				onSuccess: function (t) {
					// see TreeDisplay.js
					var treeDisplay = new gs.Pekoe.TreeDisplay();
					treeDisplay.init(resultsBlockId, t.responseXML,f,null);
					treeDisplay.renderIt();
					$(resultsBlockId).select("li").each(function (n) {
						new Drag(n,{classname : 'drag', 
							caption   : n.pekoeNode.nodeName, 
							mouseOver: null //function () {console.log('moving');}
							 }); 
					});			
				}
			});
	},
	
	getFormattedTx3 : function(f, resultsBlockId) {
		var href = "/exist/rest" + f;		
		options = { method: "get"};
		$(resultsBlockId).ajaxUpdate(href,options);		
	},
	
	getFormattedTx2 : function (f,resultsBlockId) {
		var href = "/exist/rest" + f;
		$(resultsBlockId).ajaxUpdate(href);
	},
	
	editFolder : function (evt) {
		var sp = evt.target;
		var title = sp.getAttribute('title');
		window.location.href = "http://" + window.location.host + "/exist/pekoe/admin/templates.xql?panel=templates&collection=" + title;
	},
	
	editTemplate : function (evt) {
		var sp = evt.target;
		var fpath = sp.getAttribute('title');
		fpath = fpath.replace("/db/pekoe/templates","/db/pekoe/config/template-meta");
		fpath = fpath.replace(/\..*$/, ".xml");
		console.log("editTemplate calling showEditor for fpath",fpath);
	   	var doctype = "ph-links";
		gs.Pekoe.main.currentTransaction = fpath;
		gs.Pekoe.main.currentDoctype = doctype;
		gs.Pekoe.main.showEditor();
		//gs.Pekoe.main.setTemplate()
		//window.location.href = "http://" + window.location.host + "/exist/pekoe/admin/field-editor.xql?tmpl=" + title;
	},
	*/
	} // end of return statement for gs.utility
	}(); // end Utility Singleton
	
	
//Element.addMethods({
//  ajaxUpdate: function(element, url, options){
//    element = $(element);
//    element.update('<img src="graphics/circle-ball-dark-antialiased.gif" alt="loading..." />');
//    new Ajax.Updater(element, url, options);
//    return element;
//  }
//});



// Register a callback for ALL AJAX onComplete events. 
// The documentation suggests that all callbacks are available, but only the 'responder callbacks'
// are valid: onCreate, onComplete, onException. (There are a few others that aren't guaranteed.)
// onSuccess is not in this list. 
// ALSO, note that the responding function receives 3 params. The first is the Request object
// which has a transport object which contains the response body (as text and possibly xml) 
//Ajax.Responders.register({
//  onComplete: gs.Utility.securityCheck,
//  onError: gs.Utility.errFunc
//  
//});
//
//// the new Object.create method...
//if (typeof Object.create !== 'function') {
//    Object.create = function (o) {
//        function F() {}
//        F.prototype = o;
//        return new F();
//    };
//}

Math.toWords = function (nAsNumberOrString) {
	//console.log("n is",nAsNumberOrString);
	var million = 1000000;
	var thousand = 1000;
	var hundred = 100;
	var twenty = 20;
	var ten = 10;
		
	function numberToWords(n) {
	  var numberParts = n.toString().split('.');
	  // 123,231,786.35
	  // One hundred and Twenty-three million, two hundred and thirty-one thousand, seven hundred and eighty-six dollars and thirty-five cents
	
	  // process the cents and dollars separately
	  var integerPart = numberParts[0];
	  var integerWords = makeWords(integerPart);
	  var integerCurrency = (integerPart == 1) ? " dollar" : " dollars";
	  integerWords += integerCurrency;
	  var decimalPart = numberParts[1];
	  if (decimalPart != null) {
	    // it could be 1 (ten) or 01, so check the length and multiply accordingly
	    decimalPart = (decimalPart.length == 1) ? decimalPart *= 10 : decimalPart *= 1;
	    var decimalWords = makeWords(decimalPart);
	    if (decimalWords != "zero") {
	      var decimalCurrency = (decimalPart == 1) ? " cent" : " cents";
	      integerWords += " and " + decimalWords + decimalCurrency;
	    }
	  }
	  return integerWords;
	}


	function makeWords(n) {
	
	  if (n >= million) {
	    var millionPart =  makeWords(Math.floor(n/million)) + " Million";
	    var remainder = n % million;
	    if (remainder > 0) {
	      millionPart += conjunctionFor(remainder) + makeWords(remainder);
	    }
	    return millionPart;
	  }
	  if (n >= thousand) {
	    var thousandPart = makeWords(Math.floor(n/thousand)) + " Thousand";
	    var remainder = n % thousand;
	    if (remainder > 0) {
	      thousandPart += conjunctionFor(remainder) + makeWords(remainder);
	    }
	    return thousandPart;
	  }
	
	  if (n >= hundred) {
	    var hundredPart = makeWords(Math.floor(n/hundred)) + " Hundred";
	    var remainder = n % hundred;
	    if (remainder > 0) {
	      hundredPart += conjunctionFor(remainder) + makeWords(remainder);
	    }
	    return hundredPart;
	
	  }
	
	  if (n >= twenty) {
	    var tensPart = nWords.tens[Math.floor(n/ten)];
	    var remainder = n % ten;
	    if (remainder > 0) {
	      tensPart += nWords.conjunctions["tens-to-digits"] + makeWords(remainder);
	    }
	    return tensPart;
	  }
	  if (n >= 0) {
	    return nWords.units[n];
	  }
	}
	
	function conjunctionFor(n) {
	  var theType = "";
	  if (Math.floor(n/hundred) >=  1) {
	    theType = "to-hundreds";
	  } else {
	    theType = "to-tens";
	  }
	  return nWords.conjunctions[theType];
	}
	var nWords =  
		{"units" :[ "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
				"Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
			, 
		"tens" : [ null, "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
			, 
		"other" : 
			[ 
				{"0": "Zero"}, 
				{"100": " Hundred"}, 
				{"1000": " Thousand"}, 
				{"1000000": " Million"}]
			, 
		"conjunctions" : {
			"integer-to-decimal": " and ", 
			"to-hundreds": ", ", 
			"to-tens": " and ", 
			"tens-to-digits": "-"},
		 "currency-words" : {"integer" : " dollar", "integers" : " dollars", "decimal" : " cent", "decimals" : " cents"}};
return numberToWords(nAsNumberOrString);
};

Math.toCurrencyString = function (nAsNumberOrString) {
	var numberParts = nAsNumberOrString.toString().split('.');
	
	return "$" + splitter(numberParts[0]) + decimals(numberParts[1]);
	
	function decimals(n) {
		if (n) {
			return "." + ((n.length == 1) ? n + "0" : n );
			
		} else {
			return ".00";
		}
	}
	function splitter(n) {
		return n.replace(/(.*)(\d{3})$/, replacer);
	}
	
	function replacer(matchingString,p1,p2,i,fullString) {
		if (p2 == fullString) { 
	    	return p2;
		} else {
			return [splitter(p1),p2].join();
	    }
	}
		var parts = nAsNumberOrString.replace(/(.*)(\d{3})$/, function(matchingString,p1,p2) {
			return [p1,p2].join();
		});
		function lastThree(){
			
		}
};


