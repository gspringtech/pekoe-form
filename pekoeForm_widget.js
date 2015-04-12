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


	$.widget("ui.timepicker", $.ui.spinner, {
		options: {
			step: 60 * 1000,
			page: 60	},
		_parse: function (value) {
			if (typeof value === "string") {
				if (Number( value ) == value) {
					return Number(value);
				}
				return +Globalize.parseDate( value);
			}
			return value;
		},
		_format : function ( value ){
			return Globalize.format(new Date( value), "t");
		}
	});

	$.statusMessage = function (msg){
        // TODO needs to be queued.
		$("#status")
			.hide()
			.html("<span class='status_message'>" + msg + "</span>")
			.fadeIn(100)
			.delay(5000)
			.fadeOut(5000);
	};

	gs.templateCache = {};

	
	    
	$.widget("gs.pekoeForm", { // as a widget, this needs to be an Object Literal
		_create : function () {},
		
		_init: function () {
			var self = this;
			//console.log('this is ',this);
			var saveBtn = $("<button>Save</button>")
	    		.button({text: true, disabled:true}) // button will be enabled when $wrapper receives "dirty" event from PekoeForm
	    		.click(function () { 
	    			$( document.activeElement ).blur();
	    			self.save();
	    			
	    			
				});
	    	self.options.saveButton = saveBtn;

			var closeBtn = $("<button>Close</button>")
				.button({text: true, disabled:false})
				.click(function () {
					$( document.activeElement ).blur();
					pekoeClose();


				});
			self.options.closeButton = closeBtn;

	    	
	    	var savePrintBtn = $("<button>Get final document</button>")
	    		.button({text: true, disabled: true}) // Consider changing the name according to the document type. (eg. Download/Open Word, View HTML.
	    		.click(function () { 
	    			$( document.activeElement ).blur();
	    			// IS the document dirty? Do we need to SAVE first?
					var o = self.options;
					// BIGGEST problem with form based merge (or even location.href=...) 
					// is that there's no way to handle an error without losing the context of this page 

					// TODO make this open a new window
					if (o.template) {
						// perhaps there's a way to ask for this and then get it when it works.
						// send the original merge request via Ajax and then do the download when a positive response is received.
						// but that brings me back to storing artifacts in the DB.
						var path = o.template + "?job=" + o.file.getPath();
						$.statusMessage("merge " +path);
						window.location.href= "merge" + path; // THIS IS IT. It doesn't handle server-side errors.
					}

				});
	    	self.options.savePrintButton = savePrintBtn; 
	    	
	    	
	    	var controls = $("<span class='ui-widget-header ui-corner-all' style='padding: 10px 4px;'></span>").append(saveBtn).append(closeBtn); //.append(savePrintBtn);
	    	self.options.savePrintButton.button("option","disabled",true);
			self.options.controls = controls;
			var $div = $("<div class='form-controls'></div>");
	    	$div.append(controls);
	    	var $wrapper = $("<div></div>");
	    	
	    	$wrapper.on("dirty", function(e) {
    			self.options.saveButton.button("option","disabled",false);
    		});
    		
			this.options.formArea = $wrapper;
			this.options.template = null;
			this.options.markers = null;
			$div.append($wrapper);
			this.element.append($("#bag")); // move it from wherever it is
			this.element.append($div);			
		}, // end _init
		
		updateControls : function () {
			var self = this;
			// remove existing site-controls
			self.options.controls.find(".site-control").remove();
			// add custom commands associated with this doctype and template.
			$(this.options.markers).find("command").each(function () {

				var $c = $(this);
				// does $c have an attribute "applies-to"?
				if ($c.attr("template-type")) {
					//console.log('applies-to?');
					var templateType = self.options.template.replace(/^[^.]+\./,'');
					if ($c.attr("template-type").split(',').indexOf(templateType) === -1) {
						//console.log('... no');
						return;
					}
				}
				// if so, does it match this template
				var button = $("<button class='site-control'></button>")
					.text($c.attr("name"))
					.attr("title",$c.attr("description"))
		    		.button({text: true, disabled: false}) // Consider changing the name according to the document type. (eg. Download/Open Word, View HTML.
		    		.click(function () { 
		    				eval($c.text()); // will have access to the whole context - including self.options etc.
		    		});
				self.options.controls.append(button);
			});
			
		},
		
		setFile : function (f) {
			this.options.file = f;
            console.log('setfile called with');
			$.when(f.req, this.options.bag).then(function () {
                console.log('when is now. f is',f);
				var doctype = f.getDoctype();
				gs.bag.filter(doctype);
				// I need to store the template title and then use it to select the span and activate ti
				var previousTemplate; 	// TODO save the previousTemplate as a cookie
				if (previousTemplate) {

				} else {
					gs.bag.findDefault(doctype);
				}
			});
			this._loadThings();			
		},
		
		save : function () {
//			console.log("You saved me");
			var o = this.options; 
			o.file.setData(o.formThing.getData());
			o.file.save();
			o.saveButton.button("option","disabled",true);
			console.log('save button?', o.saveButton);
//			o.savePrintButton.button("option","disabled",true);
		},

		
		_loadThings: function () {
			var self = this;
			$.when(self.options.file.req, self._loadSchema(), self._chooseTemplate())
				.then(function () {
					var formOptions = {
							element: self.options.formArea,
							file: self.options.file
					};
					self.updateControls();
                    self.options.formArea.addClass('waiting');
					var mainWork = new gs.Pekoe.Form(formOptions); // In theory I could make a new one each time. Just need to check my generated IDs 
					mainWork.display(self.options.markers);
                    self.options.formArea.removeClass('waiting');
					self.options.formThing = mainWork;
					// if setTemplate is called, it can call formThing.display().
				})
				.fail(function () {
                    $.statusMessage("Unable to load the form. Has the file been moved?");
				});
		},
		
		
		
		options: {
			file: null, // file is a pekoeFile
			schemaLoaded: false, 
			schema :null
		}, 
		
		// this instance of the widget can have its Template changed, but not its schema or file ( but we  don't have control over the schema at the moment)
	
		_loadSchema : function () {
			// okay - so this may have some other stuff happening first, similar to the jobFile 
			// where its entirely possible that the file might be loaded already ( or newly created)
			var dfd = $.Deferred();
			var req = dfd.promise(); // we'll manually resolve this promise.
			var self = this;
			if (this.options.schemaLoaded) {
//				console.log("Schema is loaded");
				dfd.resolve(); // it's resolved already		
			} else {
				$.when(gs.Pekoe.merger.Utility.loadSchema(this.options.file.getDoctype()))
					.then(function (){
						self.options.schemaLoaded = true;
						//gs.bag.filter(self.options.file.getDoctype()); // only relevant if the schema changes. Will not happen in pekoe4.
						dfd.resolve();
					});
			}
			
			return req;
		},
		
		refresh : function () {
			var doctype = this.options.file.getDoctype();
			//console.log('GOING TO REFRESH',doctype);
			gs.bag.filter(doctype); 
		},
		
		doctype : function () {
			if (this.options.file) {
			return this.options.file.getDoctype();
			} else return null;
		},
		
		template : function () {
			return this.options.template;
		},
		
		_chooseTemplate: function() { // either display form using existing Template or Ask User to choose. (needs rethinking)
			var self = this;
			var doctype = this.options.file.getDoctype();
			if (doctype === "result") {
				$.statusMessage( $(this.options.file.doc).text());
			};
			var dfd = $.Deferred();
			var req = dfd.promise(); // we'll manually resolve this promise.
			if (gs.templateCache[doctype]) { // we've got a template for this doctype - (ie. last used) - so reuse it.
				// What is the Template Name? is it in the cache?
				//self.options.savePrintButton.button("option","label","Get " + templateName).button("option","disabled",false);
				
				
				self.options.markers = gs.templateCache[doctype].markers; // $(markers).find("link"); $(markers).find("commands")
				this.options.template = gs.templateCache[doctype].href; // Where has this been stored?
				dfd.resolve();
				this.setTemplate = this.changeTemplate; // change the setTemplate method to changeTemplate
//				self.updateControls();
				return req; // EXIT
			}
			// If a suitable template has not been used recently, then ask the User to pick one. (calling setTemplate below)
			self.options.templatePromise = dfd; // promise will be kept by setTemplate
			var message = "Loading template for '" + doctype + "'";
			$(this.options.formArea).html("<h2>"+message+"</h2>");
			return req; // we can resolve this using this.options.templatePromise
		},
		
		setTemplate	: function (href) {  // first called when a template is clicked
			var self = this;
			this.options.template = href;
		    
			// AJAX request sent to templates.xql.
			$.get("/exist/pekoe-app/templates.xql", {"get":"links","template":href}, function (d) {
				var doctype = self.options.file.getDoctype();
				var linksFor = $(d).find("links").attr("for");
				if (linksFor !== doctype) { // TODO NOTE - this is a temporary solution to the problem caused by ONE Bag. 
					return; 
				}
				self.options.markers = d;
				gs.templateCache[self.options.file.getDoctype()] = {markers: d, href:href};
				
				self.options.templatePromise.resolve(); // EXCELLENT!
			});
			var templateType = href.split(".");
			var templateName = href.split("/").pop();
			self.options.savePrintButton.button("option","label","Get " + templateName).button("option","disabled",false);
			this.setTemplate = this.changeTemplate; // change to ...
		},
		
		changeTemplate : function (href) {  // subsequent calls to setTemplate...
			var self = this;
			//console.log('change template');
			this.options.template = href; 

			$.get("/exist/pekoe-app/templates.xql", {"get":"links","template":href}, function (d) {
				var doctype = self.options.file.getDoctype();
				var linksFor = $(d).find("links").attr("for");
				if (linksFor !== doctype) {
					$.statusMessage("Your doctype of '" + doctype + "' can't be displayed in a template made for '"+ linksFor + "'");
					return; 
				}
				self.options.markers = d; 
				// this is hardly a cache if we're going to load it every time.
//				gs.templateCache[self.options.file.getDoctype()] = d; //  this is NAUGHTY as it may upset any other TAB
				gs.templateCache[self.options.file.getDoctype()] = {markers: d, href:href};
				var o = self.options; 
				// need to check whether the file is dirty before 
    			o.file.setData(o.formThing.getData()); // getting the data ensures it's pruned of empty branches before displaying in another template
    			self.updateControls();
				o.formThing.display(d);
			});
			var templateType = href.split(".");
			var templateName = href.split("/").pop();
			self.options.savePrintButton.button("option","label","Get " + templateName).button("option","disabled",false);

		},
		
		isDirty : function () {
			return (this.options.saveButton.button("option","disabled") === false);
		},
		
		destroy : function () {
//			console.log("Destroy method");
			if (this.options.file && this.options.file.isCaptured()) {
				this.options.file.release();
			} else {
				console.log("file wasn't captured - so can't release."); // So WHY ...?
				this.options.file.release();
			}

			$.Widget.prototype.destroy.apply(this, arguments);
		}
	});
})(jQuery);
