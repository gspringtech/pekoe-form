/**
 * Created by alisterpillow on 7/06/2015.
 */

// consider this from the perspective of the field enhancement (which uses $field) and the javascript 'lookup'.
gs.inputWrapper = function(_fe) { // state management for the form element and the command-buttons
	var $fe = $(_fe);
	var pekoeNode = _fe.pekoeNode;
	var _state = $fe.val() === '' ? 'initially-empty' : 'initially-set';
	var commandState = function () {
		$fe.siblings('.command-button').hide(); // first, hide all buttons
		var activeStateClass = ".always, ." + _state;
		$fe.siblings(activeStateClass).show(); // show those buttons that match the current state or 'always'
	};
	$fe.on('change', function (){  // if the form element is changed by the user, update the state.
		if ($fe.val() === ''){
			_state = 'currently-empty';
		} else {
			_state = 'currently-set'
		}
		commandState(); // update visibility
	});

	var  xPath = function(contextNode) { // create an xpath evaluator from the context node
		return function(path) {
			var theDoc = contextNode.ownerDocument;
			var iterator = theDoc.evaluate(path, contextNode, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
			var found = [];
			var res;
			while (res = iterator.iterateNext()){
				found.push(res);
			}
			return found;
		}
	};

	var nodeAccessor = function(nodeArr) { // will provide get/set .value and .arr to return an array of the nodes.
		if (nodeArr.length === 0) return null;
		var _nodes = (Array.isArray(nodeArr)) ? nodeArr : [nodeArr];
		var makeAccessor = function (_node) {
			var $fe = $(_node.formElement);

			return {
				get value() { return _node.textContent; },
				set value(v) {if ($fe.length) { console.log('set',v); $fe.val(v); $fe.trigger('change'); } else {_node.textContent = v;} }
			};
		};
		var accessors = _nodes.map(makeAccessor);
		return {
			get value()  { return (accessors.length > 1) ? accessors.map(function (n) {return n.value;})  : accessors[0].value},
			set value(v) {
				for (var i = 0; i < accessors.length; i++ ) {
					accessors[i].value = v;
				}
			},
			nodes : _nodes
		};
	};

	return {
		_init : function () {commandState(); delete this._init;},
		xpe : xPath(pekoeNode),
		nodeAccessor : nodeAccessor,
		pkn: pekoeNode,
		get value() {return $fe.val(); },
		set value(newV) {$fe.val(newV); $fe.trigger('change'); },
		get state () {return _state;},
		set state (newS) {_state = newS; commandState();},
		get lock () { $fe.attr('disabled') && fe.attr('disabled') === 'disabled';},
		set lock (newTruthy) {if (newTruthy) {$fe.attr('disabled','disabled');}}
	};
};