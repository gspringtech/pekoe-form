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


	// TODO - put this somewhere more useful and Queue it. Consider using a modal for the error.
	$.statusMessage = function (msg,err){
        // TODO needs to be queued.
		if (err) {
			console.error('STATUS ERROR',msg, err);
			$("#status")
				.hide()
				.html("<span class='error_message'>" + msg + "</span>")
				.fadeIn(100)
				.delay(8000)
				.fadeOut(3000);
		} else {
			console.log('STATUSMESSAGE:',msg);
			$("#status")
				.hide()
				.html("<span class='status_message'>" + msg + "</span>")
				.fadeIn(100)
				.delay(5000)
				.fadeOut(3000);
		}
	};

	$( document ).ajaxError(function( event, jqxhr, settings, thrownError ) {
		$.statusMessage( "Please report an error for " + settings.url,true );
	});

	gs.templateCache = {};

	
	    
	$.widget("gs.pekoeForm", { // as a widget, this needs to be an Object Literal
		_create : function () {},
		
		_init: function () {
			var self = this;

			var closeBtn = $("<button>Close</button>")
				.button({text: true, disabled:false})
				.click(function () {
					$( document.activeElement ).blur();
					pekoeClose();
				});
			self.options.closeButton = closeBtn;
	    	
	    	var controls = $("<div class='ui-widget-header ui-corner-all' style='padding: 10px 4px;'></div>").append(closeBtn);
			self.options.controls = controls;
			var $div = $("<div class='form-controls'></div>");
	    	$div.append(controls);
	    	var $wrapper = $("<div></div>");
	    	
	    	$wrapper.on("dirty", function(e) {
				self.options.dirty = true;
				$('.enable-when-dirty').button("option","disabled",false);
				$('.enable-when-clean').button("option","disabled",true);
    		});
    		
			this.options.formArea = $wrapper;
			this.options.templateData = null;
			this.options.template = null;
			this.options.markers = null;
			this.options.dirty = false;
			$div.append($wrapper);
			this.element.append($div);			
		}, // end _init
		
		updateControls : function () {
			var self = this;
			// remove existing site-controls
			self.options.controls.find(".site-control").remove();
			// add custom commands associated with this doctype and template.
			$(this.options.markers).find("command").each(function () {
				// these site commands are already filtered for this template and doctype

				var $c = $(this);
				// when should this button be enabled?
				var enableClass = "enable-when-" + $c.attr('enable-when');
				var enabled =  (enableClass === 'enable-when-always')
					|| ((enableClass === 'enable-when-dirty') && self.options.dirty)
					|| ((enableClass === 'enable-when-clean') && !self.options.dirty);

				var button = $("<button class='site-control'></button>")
					.text($c.attr("name"))
					.attr("title",$c.attr("description"))
					.addClass(enableClass)
		    		.button({text: true, disabled: !enabled}) // Consider changing the name according to the document type. (eg. Download/Open Word, View HTML.
		    		.click(function () { 
		    				eval($c.text()); // will have access to the whole context - including self.options etc.
		    		});
				self.options.controls.append(button);
			});
			
		},
		
		setFile : function (f) {
			this.options.file = f;
            //console.log('setfile called with',f);
			$.when(f.req, this.options.bag).then(function () {
                //console.log('when is now. f is',f);
				var doctype = f.getDoctype();
				gs.bag.filter(doctype);
				// I need to store the template title and then use it to select the span and activate
				// if there's a template in the args, then load it .
				var previousTemplate = gs.template ? gs.template : null; 	// TODO save the previousTemplate as a cookie
				if (previousTemplate) {
					console.log('find and load',previousTemplate);
					if (!gs.bag.reveal(previousTemplate)) {
						console
						gs.bag.findDefault(doctype);
					}
				} else {
					gs.bag.findDefault(doctype);
				}
			});
			this._loadThings();			
		},
		
		save : function () {
			var o = this.options; 
			o.file.setData(o.formThing.getData());
			var promise = o.file.save();
			$('.enable-when-clean').button("option","disabled",false);
			$('.enable-when-dirty').button("option","disabled",true);
			o.dirty = false;
		        return promise;
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
					self.options.formArea.append('<img style="position:relative; top:50%; left:50%" src="css/graphics/wait-antialiased.gif" >');
					var mainWork = new gs.Pekoe.Form(formOptions); // In theory I could make a new one each time. Just need to check my generated IDs

					//TODO here's an odd one. I want the Console to show the error, but this try block will prevent it from showing the line numbers
					//try {
						mainWork.display(self.options.markers);
					self.options.formThing = mainWork;
				})
				.fail(function () {
                    $.statusMessage("Unable to load the form. The file may be locked. Please use the Files list to confirm.");
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
		
		setTemplate	: function (templateData) {  // first called when a template is clicked
			var self = this;
			this.options.templateData = templateData;
			var href = templateData.path;
			this.options.template = templateData.path;
		    
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
			//self.options.savePrintButton.button("option","label","Get " + templateName).button("option","disabled",false);
			this.setTemplate = this.changeTemplate; // change to ...
		},

		// TODO - use this to CHANGE THE ARGS TO REFLECT THIS TEMPLATE

		changeTemplate : function (templateData) {  // subsequent calls to setTemplate...
			var self = this;
			this.options.templateData = templateData;
			var href = templateData.path;
			this.options.template = templateData.path;

			$.get("/exist/pekoe-app/templates.xql", {"get":"links","template":href}, function (d) {
				var doctype = self.options.file.getDoctype();
				var linksFor = $(d).find("links").attr("for");
				if (linksFor !== doctype) {
					$.statusMessage("Your doctype of '" + doctype + "' can't be displayed in a template made for '"+ linksFor + "'");
					return; 
				}
				self.options.markers = d; 
				// this is hardly a cache if we're going to load it every time.
				gs.templateCache[self.options.file.getDoctype()] = {markers: d, href:href};
				var o = self.options; 
				// need to check whether the file is dirty before
				if (o.formThing) {
					o.file.setData(o.formThing.getData()); // getting the data ensures it's pruned of empty branches before displaying in another template
					self.updateControls();
					o.formThing.display(d);
				} else {
					console.warn("No Form Loaded",self);
					self.element.append("<h1>No Form loaded - please Close and try again.</h1>");
					self.element.append("<div>(Check the Console for an error message.)</div>");
				}
			});
			var templateType = href.split(".");
			var templateName = href.split("/").pop();
		},
		
		isDirty : function () {
			return (this.options.dirty );
		},
		
		destroy : function () {
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
