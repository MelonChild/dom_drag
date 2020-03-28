/**
 * drag.js 1.1.1-dev
 * https://console.kewo.com/
 * (c) 2019-2020 MelonChild
 * drag.js may be freely distributed under the MIT license.
 * @preserve
 */
(function(factory) {
    /* [alain] we compile jquery with our code, so no need to 'load' externally
    if (typeof define === 'function' && define.amd) {
      define(['jquery', 'exports'], factory);
    } else if (typeof exports !== 'undefined') {
      var jQueryModule;
  
      try { jQueryModule = require('jquery'); } catch (e) {}
  
      factory(jQueryModule || window.jQuery, exports);
    } else */
    {
        factory(window.jQuery, window);
    }
})(function($, scope) {

    var Utils = {
        // merge two options
        defaults: function(target) {
            var sources = Array.prototype.slice.call(arguments, 1);
            sources.forEach(function(source) {
                for (let prop in source) {
                    if (source.hasOwnProperty(prop) && (!target.hasOwnProperty(prop) || target[prop] === undefined)) {
                        target[prop] = source[prop]
                    }
                }
            });
            return target;
        },
        throttle: function(callback, delay) {
            var isWaiting = false;

            return function() {
                if (!isWaiting) {
                    callback.apply(this, arguments);
                    isWaiting = true;
                    setTimeout(function() { isWaiting = false; }, delay);
                }
            };
        },
        createStylesheet: function(id, parent) {
            var style = document.createElement('style');
            style.setAttribute('type', 'text/css');
            style.setAttribute('data-style-id', id);
            if (style.styleSheet) {
                style.styleSheet.cssText = '';
            } else {
                style.appendChild(document.createTextNode(''));
            }
            if (!parent) { parent = document.getElementsByTagName('head')[0]; } // default to head
            parent.insertBefore(style, parent.firstChild);
            return style.sheet;
        },
        removeStylesheet: function(id) {
            $('STYLE[data-gs-style-id=' + id + ']').remove();
        },

        insertCSSRule: function(sheet, selector, rules, index) {
            if (typeof sheet.insertRule === 'function') {
                sheet.insertRule(selector + '{' + rules + '}', index);
            } else if (typeof sheet.addRule === 'function') {
                sheet.addRule(selector, rules, index);
            }
        },
        toBool: function(v) {
            if (typeof v === 'boolean') {
                return v;
            }
            if (typeof v === 'string') {
                v = v.toLowerCase();
                return !(v === '' || v === 'no' || v === 'false' || v === '0');
            }
            return Boolean(v);
        },
        createNode: function(opts) {

            // create item dom
            var itemNode = document.createElement('div');
            itemNode.setAttribute('class', opts['itemClass']);

            // item content
            var handleClass = opts['handleClass'] || "panel-item-drag";
            const itemTemplate = '<div class="panel-item-title"><div class="' + handleClass + '">drag title</div></div><div class="panel-item-content"></div>';
            itemNode.innerHTML = itemTemplate;

            // set content innerhtml
            var contentDom = itemNode.getElementsByClassName("panel-item-content")[0];
            contentDom.innerHTML = opts['content'];
            return itemNode;
        },
        createResizeNode: function(direction) {
            // create item dom
            var itemNode = document.createElement('div');
            itemNode.setAttribute('data-direction', direction);
            itemNode.className = 'panel-resize-boder';
            itemNode.style.background = 'red';
            itemNode.style.width = '4px';
            itemNode.style.height = '4px';
            itemNode.style.position = 'absolute';
            itemNode.style.bottom = '5px';
            if (direction == 'l') {
                itemNode.className += ' panel-resize-bl';
                itemNode.style.cursor = 'w-resize';
                itemNode.style.left = '0';
                itemNode.style.height = '80%';
            }
            if (direction == 'r') {
                itemNode.className += ' panel-resize-br';
                itemNode.style.cursor = 'e-resize';
                itemNode.style.right = '0';
                itemNode.style.height = '80%';
            }
            if (direction == 'b') {
                itemNode.className += ' panel-resize-bb';
                itemNode.style.bottom = '0';
                itemNode.style.cursor = 's-resize';
                itemNode.style.width = '100%';
            }
            return itemNode;
        }
    }

    var PanelDragEngine = function(el, opts) {
        this.$el = $(el);
        this.el = el;
        opts.wrap || 'panel-stack';
        opts.parent || 'panel-item';
        this.opts = Utils.defaults(opts, {
            wrap: 'panel-stack',
            parent: 'panel-item',
            handleClass: 'panel-item-drag'
        });
        this.boxWidth = 0;
        this.boxHeight = 0;
        this.currentNode = '';
        this.zindex = 100;
        this.nodes = [];
    };
    PanelDragEngine.prototype.enableResize = function(el) {
        el.appendChild(Utils.createResizeNode('l'));
        el.appendChild(Utils.createResizeNode('r'));
        el.appendChild(Utils.createResizeNode('b'));

    };
    PanelDragEngine.prototype.initItem = function(el) {
        var _this = this;

        var $el = $(el);
        var nodeId = 'panel-item-' + (Math.random() * 10000).toFixed(0);
        var handler = $el.find('.' + _this.opts.handleClass);
        $el.addClass(nodeId);
        $el.css({ position: 'absolute', 'z-index': _this.getNodeIndex() });
        $el.attr('data-item-id', nodeId);
        handler.attr('data-item-id', nodeId);
        _this.nodes[nodeId] = {
            el: $el,
            width: $el.outerWidth(),
            height: $el.outerHeight(),
            minWidth: 100,
            minHeight: 100,
        };
        // 图片点击，停止冒泡
        $el.find('*').not('img').mousedown(function(e) {
            e.stopPropagation();
        });
        // enable resize
        _this.enableResize(el);
        var resizeHandler = $el.find('.panel-resize-boder');
        resizeHandler.mousedown(function(e) {
            var item = $(this).parent().attr('data-item-id');
            if (_this.nodes[item]) {
                var nodeItem = _this.nodes[item];
                nodeItem['type'] = 'resize';
                nodeItem['direction'] = this.getAttribute('data-direction');
                nodeItem['left'] = nodeItem.el.position().left;
                nodeItem['top'] = nodeItem.el.position().top;
                nodeItem['width'] = nodeItem.el.outerWidth();
                nodeItem['height'] = nodeItem.el.outerHeight();
                nodeItem['pageX'] = e.pageX;
                nodeItem['pageY'] = e.pageY;
                $el.addClass('on');
                $el.css('z-index', _this.getNodeIndex());
                _this.setCurrentNode(nodeItem);
                return false;
            }

        });

        handler.css({ cursor: 'move' }).mousedown(function(e) {
            var item = handler.attr('data-item-id');
            if (_this.nodes[item]) {
                var nodeItem = _this.nodes[item];
                nodeItem['type'] = 'drag';
                nodeItem['left'] = nodeItem.el.position().left;
                nodeItem['top'] = nodeItem.el.position().top;
                nodeItem['width'] = nodeItem.el.outerWidth();
                nodeItem['height'] = nodeItem.el.outerHeight();
                nodeItem['pageX'] = e.pageX;
                nodeItem['pageY'] = e.pageY;
                $el.addClass('on');
                $el.css('z-index', _this.getNodeIndex());
                _this.setCurrentNode(nodeItem);
                return false;
            }
        });
    };
    PanelDragEngine.prototype.getNodeIndex = function() {
        return this.zindex += 1;
    };
    PanelDragEngine.prototype.setCurrentNode = function(node) {
        this.currentNode = node;
    };
    PanelDragEngine.prototype.initSize = function() {
        var _this = this;
        var $el = $('.' + _this.opts.wrap);
        _this.boxWidth = $el.outerWidth();
        _this.boxHeight = $el.outerHeight();
    };

    PanelDragEngine.prototype.run = function() {
        var _this = this;
        var $el = _this.$el;


        _this.initSize();
        var boxWidth = _this.boxWidth,
            boxHeight = _this.boxHeight;

        $el.css({ position: 'relative' });

        $(document).mouseup(function(e) {
            // currentNode.dragEnd(parseInt(currentElement.css('left')), parseInt(currentElement.css('top')));
            $el.find("." + _this.opts.parent).removeClass('on');
            _this.currentNode = '';
        });
        $(document).mousemove(function(e) {
            var currentNode = _this.currentNode;
            var currentElement = currentNode.el;
            if (currentNode && currentNode.pageX >= 0 && currentNode.pageY >= 0) {

                //drag
                if (currentNode.type == 'drag') {
                    var moveX = currentNode.left + e.pageX - currentNode.pageX;
                    var moveY = currentNode.top + e.pageY - currentNode.pageY;
                    moveX < 0 && (moveX = 0);
                    moveX > (boxWidth - currentNode.width) && (moveX = (boxWidth - currentNode.width));
                    moveY < 0 && (moveY = 0);
                    moveY > (boxHeight - currentNode.height) && (moveY = (boxHeight - currentNode.height));
                    currentElement.css({ left: moveX, top: moveY });
                };

                //resize
                if (currentNode.type == 'resize') {
                    var width = currentNode.width + e.pageX - currentNode.pageX;
                    if (currentNode.direction == 'l') {
                        width = currentNode.width + currentNode.pageX - e.pageX;
                    }
                    var height = currentNode.height + e.pageY - currentNode.pageY;
                    width < currentNode.minWidth && (width = currentNode.minWidth);
                    if (currentNode.direction == 'l') {
                        width > (currentNode.left + currentNode.width) && (width = currentNode.left + currentNode.width);
                    } else {
                        width > (boxWidth - currentNode.left) && (width = (boxWidth - currentNode.left));
                    }
                    height < currentNode.minHeight && (height = currentNode.minHeight);
                    height > (boxHeight - currentNode.top) && (height = (boxHeight - currentNode.top));

                    if (currentNode.direction == 'r') {
                        currentElement.css({ width: width });
                    };
                    if (currentNode.direction == 'b') {
                        currentElement.css({ height: height });
                    };
                    if (currentNode.direction == 'l') {
                        var left = currentNode.left - width + currentNode.width;
                        console.log(currentNode.left, boxWidth, currentNode.width + currentNode.pageX - e.pageX, );

                        currentElement.css({ left: left, width: width });
                    };
                };


            }
        });
    };


    /**
     * Construct a grid item from the given element and options
     * @param {PanelStackElement} el
     * @param {PanelStackOptions} opts
     */
    var PanelStack = function(el, opts) {
        var _this = this;

        opts = opts || {}

        this.$el = $(el);
        this.el = this.$el.get(0);
        opts.wrapClass = opts.wrapClass || 'panel-stack';
        opts.itemClass = opts.itemClass || 'panel-item';
        // elements attributes override any passed options (like CSS style) - merge the two together
        this.opts = Utils.defaults(opts, {
            wrapClass: 'panel-stack',
            itemClass: 'panel-item',
            _class: 'panel-stack-instance-' + (Math.random() * 10000).toFixed(0),
            disableDrag: opts.disableDrag || false,
            handleClass: "panel-item-drag"
        });
        this.$el.addClass(this.opts._class);

        // init item drable
        this.engine = new PanelDragEngine(el, {});
        this.$el.children('.' + this.opts.itemClass)
            .each(function(index, el) {
                _this.engine.initItem(el);
            });
        this.engine.run();
        /**
         * called when we are being resized 
         */
        this.onResizeHandler = function() {
            Utils.throttle(function() {
                console.log("resize");
            }, 100);
        };
        $(window).resize(this.onResizeHandler);
        this.onResizeHandler();
    };

    PanelStack.prototype.addItem = function() {
        var opts = {
            'itemClass': this.opts.itemClass,
            'handleClass': this.opts.handleClass,
            'content': "<h4>你瞅瞅c</h4>"
        }
        var noteItem = Utils.createNode(opts);
        this.el.appendChild(noteItem);
        this.engine.initItem(noteItem);
        return noteItem;
    };

    /** called whenever a node is added or moved - updates the cached layouts */
    // PanelStackEngine.prototype.

    scope.PanelStack = PanelStack;
    scope.PanelStack.Utils = Utils;

    /**
     * initializing the HTML element, or selector string, into a grid will return the grid. Calling it again will
     * simply return the existing instance (ignore any passed options).
     */
    PanelStack.init = function(opts, elOrString) {
        console.log("console");
        if (!elOrString) { elOrString = '.panel-stack' }
        var el = $(elOrString).get(0);
        if (!el) return;
        if (!el.panelstack) {
            el.panelstack = new PanelStack(el, opts);
        }
        return el.panelstack
    };
    /**
     * Will initialize a list of elements (given a selector) and return an array of grids.
     */
    PanelStack.initAll = function(opts, selector) {
        if (!selector) { selector = '.grid-stack' }
        var panels = [];
        $(selector).each(function(index, el) {
            if (!el.panelstack) {
                el.panelstack = new PanelStack(el, Utils.clone(opts));
            }
            panels.push(el.panelstack);
        });
        return panels;
    };

    return scope.PanelStack;
});