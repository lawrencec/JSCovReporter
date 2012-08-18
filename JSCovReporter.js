JSCovFileReporter = function() {
//    Taken from https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/map
    if (!Array.prototype.map) {
        Array.prototype.map = function(callback, thisArg) {

            var T, A, k;

            if (this == null) {
              throw new TypeError(" this is null or not defined");
            }

            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);

            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;

            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if ({}.toString.call(callback) != "[object Function]") {
              throw new TypeError(callback + " is not a function");
            }

            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (thisArg) {
              T = thisArg;
            }

            // 6. Let A be a new array created as if by the expression new Array(len) where Array is
            // the standard built-in constructor with that name and len is the value of len.
            A = new Array(len);

            // 7. Let k be 0
            k = 0;

            // 8. Repeat, while k < len
            while(k < len) {

              var kValue, mappedValue;

              // a. Let Pk be ToString(k).
              //   This is implicit for LHS operands of the in operator
              // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
              //   This step can be combined with c
              // c. If kPresent is true, then
              if (k in O) {

                // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                kValue = O[ k ];

                // ii. Let mappedValue be the result of calling the Call internal method of callback
                // with T as the this value and argument list containing kValue, k, and O.
                mappedValue = callback.call(T, kValue, k, O);

                // iii. Call the DefineOwnProperty internal method of A with arguments
                // Pk, Property Descriptor {Value: mappedValue, : true, Enumerable: true, Configurable: true},
                // and false.

                // In browsers that support Object.defineProperty, use the following:
                // Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

                // For best browser support, use the following:
                A[ k ] = mappedValue;
              }
              // d. Increase k by 1.
              k++;
            }

            // 9. return A
            return A;
          };
    }
    
    return {

        initialize: function (options) {
            this.open  = '<tr class="{class}"><td class="line">{line_number}</td><td class="hits">{count}</td><td class="source">';
            this.close = '</td></tr>';

            this.coverObject = options.coverObject;

            this.error = 0;
            this.pass = 0;
            this.total = 0;
        },

        // substitute credits: MooTools
        substitute: function(string, object){
            return string.replace(/\\?\{([^{}]+)\}/g, function(match, name){
                if (match.charAt(0) == '\\') return match.slice(1);
                return (object[name] !== null) ? object[name] : '';
            });
        },

        generateClose: function(count){
            return this.substitute(this.close, {
                count: count
            });
        },

        generateOpen: function(hit_count, line_number){
            return this.substitute(this.open, {
                'count': hit_count,
                'line_number': line_number,
                'class': hit_count ? 'hit' : 'miss'
            });
        },

        report: function () {
            var thisview = this;
            var i, l, k;

            var code = this.coverObject.__code;
            var lineRanges = {};
            // generate array of all tokens
            var codez = [];
            for (i = 0, l = code.length; i < l; i++){
                codez.push({
                    pos: i,
                    value: code.slice(i, i + 1)
                });
            }
            //filter out __code property
            for (var p in this.coverObject) {
                if (p !== '__code') {
                    lineRanges[p] = this.coverObject[p];
                }
            }
            // CoverObject has keys like "12:200" which means from char 12 to 200
            // This orders all first gaps in a list of dictionaries to ease drawing table lines
            var gaps = Object.keys(lineRanges);
            var first_gaps = gaps.map(function ( gap ) {
                return {
                    gap: parseInt(gap.split(':')[0], 10),
                    hit_count: thisview.coverObject[gap]
                };
            }).sort(function (a, b) {
                if (a['gap'] > b['gap']) return 1;
                if (b['gap'] > a['gap']) return -1;
                return 0;
            });

            var second_gaps = gaps.map(function ( gap ) {
                return {
                    gap: parseInt(gap.split(':')[1], 10),
                    hit_count: thisview.coverObject[gap]
                };
            }).sort(function (a, b) {
                if (a['gap'] > b['gap']) return 1;
                if (b['gap'] > a['gap']) return -1;
                return 0;
            });


            // If it doesn't start from 0 it's because there are comments in the beginning
            // We add a initial gap with one hit
            if (first_gaps[0] !== 0) {
                first_gaps.splice(0, 0, {gap: 0, hit_count: 1});
            }

            var result = '';
            var number_trailing_whitespaces = 0;
            var trailing_whitespaces = '';


            // We will go from one gap to the next wrapping them in table lines
            for (i=0, l = first_gaps.length; i < l; i++){

                var hit_count = first_gaps[i]['hit_count'];

                this.total++;
                if (hit_count) this.pass++;
                else this.error++;

                var limit = null;
                if (i+1 >= l) {
                    limit = codez.length;
                }
                else {
                    limit = first_gaps[i+1]['gap'];
                }

                // Table line opening
                result += this.generateOpen(hit_count, this.total);

                // Add trailing white space if it existed from previous line without carriage returns
                if (number_trailing_whitespaces > 0 ) {
                    result += trailing_whitespaces.replace(/(\r\n|\n|\r)/gm,"");
                }

                // Add lines of code without initial white spaces, and replacing conflictive chars
                result += codez.slice(first_gaps[i]['gap'], limit).map(function (loc) {
                    return loc['value'];
                }).join('').trimLeft().replace(/</g, '&lt;').replace(/>/g, '&gt;');

                // Count trailing white spaces for future line, then remove them
                var matches = result.match(/(\s+)$/);
                result = result.trimRight();

                if (matches !== null) {
                    number_trailing_whitespaces = matches[0].length;
                    trailing_whitespaces = matches[0];
                }
                else {
                    number_trailing_whitespaces = 0;
                }

                // Generate table line closing
                result += this.generateClose(hit_count);
            }

            return result;
     }
    }
};
JSCovReporter = function(){
    return {

        initialize: function (options) {
            this.coverObject = options.coverObject;

            // Generate the report
            this.report();

            // Activate reporter.js scrolling UX
            JSCovReporter.onload();
        },

        report: function () {
            var result = '';
            var index = '';

            for (var file in this.coverObject) {
                var fileReporter = new JSCovFileReporter();
                fileReporter.initialize({ coverObject: this.coverObject[file] })

                var fileReport = fileReporter.report();
                var percentage = Math.round(fileReporter.pass / fileReporter.total * 100);

                this.error += fileReporter.error;
                this.pass  += fileReporter.pass;
                this.total += fileReporter.total;

                var type_coverage = "high";
                if (percentage < 75 && percentage >= 50) {
                    type_coverage = 'medium';
                }
                else if (percentage < 50 && percentage >= 25) {
                    type_coverage = 'low';
                }
                else if (percentage < 25) {
                    type_coverage = 'terrible';
                }

                // Title
                result += '<h2 id="' + file + '" class="file-title">' + file + '</h2>';
                // Stats
                result += '<div class="stats ' + type_coverage + '"><div class="percentage">'+ percentage + '%</div>';
                result += '<div class="sloc">' + fileReporter.total + '</div><div class="hits">' + fileReporter.pass + '</div>';
                result += '<div class="misses">' + fileReporter.error + '</div></div>';
                // Report
                result += '<div class="file-report">';
                result += '<table id="source"><tbody>' + fileReport + '</tbody></table>';
                result += '</div>';

                // Menu index
                index += '<li><span class="cov ' + type_coverage + '">' + percentage + '</span><a href="#' + file+ '">' + file + '</a></li>';
            }
            document.getElementById('coverage').innerHTML = result;
            document.getElementById('menu').innerHTML = index;
        }
    }
}

JSCovReporter.onload = function() {
    JSCovReporter.headings = document.querySelectorAll('#coverage h2');
    if (document.addEventListener) {
        document.addEventListener('scroll', JSCovReporter.onscroll, false);
    } else if (document.attachEvent)  {
      document.attachEvent('onscroll', JSCovReporter.onscroll);
    }
};

JSCovReporter.onscroll = function() {
    var findHeadings = function (y) {
        var i = JSCovReporter.headings.length
            , heading;

        while (i--) {
            heading = JSCovReporter.headings[i];
            if (y > heading.offsetTop) {
                return heading;
            }
        }
    }
    var compareCurrentHeading = function(link) {
        if (JSCovReporter.currentHeading && link) {
            return link.getAttribute('href') === JSCovReporter.currentHeading.getAttribute('href')
        }
        return false;
    };
    var heading = findHeadings(window.scrollY);

    if (!heading) {
        if (JSCovReporter.currentHeading) {
            JSCovReporter.currentHeading.className = ''
        }
        return;
    }

    if (JSCovReporter.currentHeading) {
        //already active
        if ('#' + heading.id === JSCovReporter.currentHeading.getAttribute('href') ) {
            return;
        }
    }

    var links = document.querySelectorAll('#menu a')
        , link;

    for (var i = 0, len = links.length; i < len; ++i) {
        link = links[i];
        link.className = !compareCurrentHeading(link) ? 'active' : '';
        JSCovReporter.currentHeading = link;
    }
}