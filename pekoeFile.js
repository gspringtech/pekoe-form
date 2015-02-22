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


 
// I THINK this is another place for jQuery Ajax DEFERRED. 
// Does the JobFile extend jQuery.Ajax?
    /*
     * 
     * The JobFile manager will work in two ways:
     * first - given a specifier (doctype:path) it will capture and load the file if its available. If not available for capture, it _could_ 
     * open it read-only. (Otherwise inform user or caller somehow)
     * second - given a doctype only, create a new document 
     * 
     * other methods are
     * Save
     * Destroy
     * Release
     * isDirty
     * 
     * and it will need some events.
     * I want to write
     * var jf = gs.Pekoe.JobFileMaker({specifier:"frogs:/db/pekoe/Frogs-list.xql?id=1234"});
     * var jf = gs.Pekoe.JobFileMaker({doctype:"txo"});
     * and then
     * displayInTab(jf).showForm(); or something. I don't want to find the tab first (it might already exist)
     * showForm(jf); showTree(jf); merge(jf)
     * Maybe these methods should be attached to the JobFile??? Arghh twisting.
     */
(function ($) {
	// Use the tabname to ensure that a document is not reloaded
	// This isn't a widget. How do I destroy it?
	// how do I do a Save?
	gs.Pekoe.pekoeFile = function (options, my) {
		my = my || {};
		// How does it work? no doctype means that the bureau won't be filtered. Choosing a Template will select the doctype.
		// But the editmode widget would then need to recognize that there's no doctype and no doc. 
		// 
		// And what about the NAME? How do I ask the user for a name?
		// A much simpler approach to this is to put a "new XXX" line for each relevant doctype into the list. (but then I'll need to 
		// deal with the missing path here - and ask the user. 
		// Most of the "database" docs can only be created from their custom lists (.xql) because they'll have a generated ID.
		// So the "new XXX" approach might be best - and only leaves the question of which docs to create, and where they can be created.
		// any File created in a general collection can have any name without restriction (other than being unique within the collection)
		// any File requiring an ID must use a custom XQuery. (That solves txo and ax and sx for CM.)
		var fInfo = options.href.split(":");
		//console.log('GOT OPTION HREF',options.href, "RESULTING IN FILE", fInfo);
		var settings = {doctype:fInfo[0], path:fInfo[1]};
		$.extend(settings, options); // extend the first object, overwriting its values // allow the doctype to be set
		var that = {doc:null, captured:false };
		
		// create or load the document. Signal ready when done
		if (!settings.path) {
			console.warn("No PATH - trying to create a new",settings.doctype);
			that.doc = $.parseXML("<" + settings.doctype + "/>" );
			that.save = function () {
				that.path = "test.xml"; // TODO - make this a filename request. also, get the collection path from the source.
				this.save = save; // reassign to normal save
				//this.save(); // call it
			};
			var dfd = $.Deferred();
			that.req = dfd.promise(); // attach the promise to the pekoeFile object
			dfd.resolve(); // it's resolved already
			// trigger something
		} else {
			// attach the promise to the pekoeFile object - it will be resolved when the doc is loaded. 
			that.req = $.get(settings.path,
				{
					"action": "capture",
                    "doctype" : settings.doctype
//					"path":   settings.path
				},
				function (d,status, jqxhr) {
					if (jqxhr.status === 201){
						settings.path = jqxhr.getResponseHeader("Location");
					}
					that.doc = d;
					var thisDocType = d.documentElement.nodeName;
					if (thisDocType !== settings.doctype) {
						if (thisDocType === "result") {
							$.statusMessage("Can't open this item: " + $(d).text()); // probably locked.
						} else {
                            console.warn("Unexpectedly received: " + thisDocType + " instead of " + settings.doctype)
							$.statusMessage("Unexpectedly received: " + thisDocType + " instead of " + settings.doctype);
						}
						return;
					}
					that.captured = true;

				}).fail(function() {
                    $.statusMessage('Unable to load the document. Has it been moved?');
                });
		} // end of load
		
		function save() {
			 	$.ajax({
			 		url: settings.path,
			 		data:that.doc,
			 		type: 'POST',
				 	processData: false,
				  	contentType: "text/xml",
			 		success: function (d,s) {
			 			// Here's a complication. When this is a New Job, we might have a path to a Query with an id:
			 			// bookings.xql?id=123
			 			// instead of a path to a Job.
			 			// If this Save request gets a new Path (easy enough), I could change the settings.path accordingly. (Safe?)
			 			// But IS THE JOB LOCKED? Probably NOT. Probably never has been.
			 			//console.log("Posted successfully:",d,s); // <result status='okay'>Saved item 347</result> success
			 			// <result status="okay" path="/db/pekoe/files/education/bookings/2012/08/booking-00349/data.xml">Saved item 349</result>
			 			// THE REAL PROBLEM IS THAT THESE "SAVE" RESULTS ARE FROM CUSTOM QUERIES.
						window.dirty = false; // TODO tabs.ctrl is checking this
			 			var returnedPath = $(d).attr("path");
			 			//console.log("path: ", settings.path, "returnedPath",returnedPath);
			 			if (returnedPath) {settings.path = returnedPath;} // Still not captured. And still not STANDARD.
			 			// SO do this by CONVENTION or in browse.xql? Make it part of the SYSTEM or leave it to beaver?
			 				
			 			
			 			// 
			 		}
			 	});				
		}
		
		// sequence is not right here.
		var destroy = function () {
			if (that.captured) {
				console.error("Destroying a pekoeFile that is still captured",that.path);
				
			} else { 
				that.doc = null;
				// call super if it exists 
			}
		};
		that.isCaptured = function () {return that.captured === true;};
		that.isDirty = function () {
			//console.log("You called isDirty on this file - this will always be true");
			return true;
		}
		that.release = function (){
			if (that.captured) {
				//console.log("Release",settings.path);
				$.get(settings.path,{"action":"release"},function (d,ts) {
					that.captured = false;
					that.destroy();
					if (window.readyToClose) { window.readyToClose(); } // call the tabs.service in Pekoe Workspace and try to close this tab
					//else {location.href=''}
					//TODO might want to redirect at this point.
				});
			} else {
				console.log("Nothing to release: file",settings.path, "wasn't initially captured");
				if (window.readyToClose) { window.readyToClose(); }
			}

		};
		that.getPath = function () {return settings.path;}
		that.destroy = destroy;
		that.save = save;
		that.getDoctype = function () { if (that.captured) { return that.doc.documentElement.nodeName} else { return settings.doctype;}};
		that.setData = function(d) {this.doc = d;};

		return that;
		
	};	
})(jQuery);
	

