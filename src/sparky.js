(function() {
    sparky = {version: "0.1"};

    function getSize(el) {
        return {
            width: ~~el.offsetWidth,
            height: ~~el.offsetHeight
        };
    }

    function extend(defaults, options) {
        var o = {};
        for (var k in defaults) {
            o[k] = defaults[k];
        }
        for (var k in options) {
            o[k] = options[k];
        }
        return o;
    }

    function functor(getter, def) {
        return (typeof getter === "function")
            ? getter
            : def || function() { return getter; };
    }

    function getter(prop) {
        return function(o) { return o[prop]; };
    }

    function identity(o) { return o; }

    function getter_or_functor(value, def) {
        return (typeof value === "function")
            ? value
            : def || identity;
    }

    sparky.sparkline = function(parent, data, options) {
        // attempt to query the document for the provided selector
        if (typeof parent === "string") {
            parent = document.querySelector(parent);
        }
        // merge defaults and options, or fetch presets
        options = (typeof options === "string")
            ? extend(sparky.sparkline.defaults, PRESETS[options])
            : extend(sparky.sparkline.defaults, options || {});

        // remember the length of the data array
        var LEN = data.length;
        // VAL is a value getter for each datum
        var VAL = getter_or_functor(options.value);
        // figure out the minimum and maximum values
        var MIN = d3.min(data, VAL),
            MAX = d3.max(data, VAL);

        // determine the sparkline's dimensions
        var SIZE = getSize(parent),
            WIDTH = options.width || SIZE.width,
            HEIGHT = options.height || SIZE.height;
        // padding is the number of pixels to inset from the edges
        var PADDING = options.padding || 0;

        // create the x and y scales
        var XX = d3.scale.linear()
                .domain([0, LEN - 1])
                .range([PADDING, WIDTH - PADDING]),
            YY = d3.scale.linear()
                .domain([MIN, MAX])
                .range([HEIGHT - PADDING, PADDING]);

        // create our Raphael surface
        var paper = Raphael(parent, WIDTH, HEIGHT);

        // create an array of screen coordinates for each datum
        var points = [];
        for (var i = 0; i < LEN; i++) {
            var x = XX(i),
                y = YY(data[i]);
            points.push({x: x, y: y});
        }

        // if "area_fill" was provided, push some more points onto the array
        if (options.area_fill && options.area_fill !== "none") {
            var bottom = YY(MIN);
            points.push({x: XX(LEN - 1), y: bottom});
            points.push({x: XX(0), y: bottom});
            points.push(points[0]);
        }

        // generate the path, and set its fill and stroke attributes
        var line = paper.path(points.map(function(p, i) {
                return [(i === 0) ? "M" : "L", p.x, ",", p.y].join("");
            }).join(","))
            .attr("fill", options.area_fill || "none")
            .attr("stroke-width", options.line_stroke_width || 1.5)
            .attr("stroke", options.line_stroke || options.color || "black");

        // define our radius and color getters for dots
        var RADIUS = functor(options.dot_radius),
            COLOR = functor(options.dot_fill || options.color || "black"),
            TITLE = functor(options.dot_title);

        // create a Raphael set for the dots
        var dots = paper.set();
        // (and stash it on the paper object for later use)
        paper.dots = dots;
        for (var i = 0; i < LEN; i++) {
            // get the screen coordinate and the value,
            var point = points[i],
                val = VAL(data[i]),
                // generate some metadata:
                meta = {
                    // true if it's first in the list
                    first: i == 0,
                    // true if it's last in the list
                    last: i == LEN - 1,
                    // true if it's >= maximum value
                    max: val >= MAX,
                    // true if it's <= minimum value
                    min: val <= MIN
                },
                // get the radius
                r = RADIUS.call(meta, data[i], i),
                // create the dot
                dot = paper.circle(point.x, point.y)
                    .attr("stroke", "none")
                    .attr("r", r);
            // set the fill if the radius > 0
            if (r > 0) {
                dot.attr("fill", COLOR.call(meta, data[i], i));
            }
            dots.push(dot);
        }

        return paper;
    };

    sparky.parse = {};
    sparky.parse.numbers = function(str, parser) {
        var numbers = str.split(/\s*,\s*/),
            len = numbers.length;
        if (!parser) parser = Number;
        for (var i = 0; i < len; i++) {
            numbers[i] = parser(numbers[i]);
        }
        return numbers;
    };

    sparky.sparkline.defaults = {
        width:              0, // 0 means "use the intrinsic width"
        height:             0, // 0 means "use the intrinsic height"
        padding:            2,
        area_fill:          null,
        value:              d3.identity,
        line_stroke:        "black",
        line_stroke_width:  1,
        dot_fill:           "black",
        dot_radius:         2
    };

    var PRESETS = sparky.sparkline.presets = {};

    // from: http://www.edwardtufte.com/bboard/q-and-a-fetch-msg?msg_id=0001OR
    PRESETS["TUFTE_HIGHLIGHT_LAST"] = {
        line_stroke: "#bbb",
        line_stroke_width: 1.5,
        dot_fill: "#f00",
        dot_radius: function(d, i) {
            return this.last ? 2 : 0;
        }
    };

    // from: http://www.edwardtufte.com/bboard/q-and-a-fetch-msg?msg_id=0001OR
    PRESETS["TUFTE_HIGHLIGHT_PEAKS"] = {
        line_stroke: "#bbb",
        line_stroke_width: 1.5,
        dot_fill: function(d, i) {
            return (this.min || this.max)
                ? "#339ACF"
                : "#f00";
        },
        dot_radius: function(d, i) {
            return (this.first || this.last || this.min || this.max)
                ? 2
                : 0;
        }
    };

})();
