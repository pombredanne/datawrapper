
(function(){


    dw.visualization.register('pie-chart', 'raphael-chart', {

        isDonut: function() {
            return false;
        },

        getFullArc: function() {
            return TWO_PI;
        },

        groupAfter: function() {
            return 4;
        },

        render: function(el) {

            this.setRoot(el);

            var me = this,
                dataset = me.dataset,
                sort = true,
                donut = me.isDonut(),
                row = 0;

            // 2d -> 1d
            if (!_.isUndefined(me.get('selected-row'))) {
                row = me.get('selected-row', 0);
                if (row > dataset.numRows() || row === undefined) row = 0;
            }

            me.axesDef = me.axes();
            if (!me.axesDef) return;

            var sliceColumns = _.map(me.axesDef.slices, function(i) { return dataset.column(i); });
                filter = dw.utils.filter(dw.utils.columnNameColumn(sliceColumns), row),
                filterUI = filter.ui(me),
                filterH = 0;

            if (filterUI) (function() {
                var $h = $('#header'),
                    oldHeaderHeight = $h.height();
                $h.append(filterUI);
                filterH = $h.height() - oldHeaderHeight;
                filter.change(function(val, i) {
                    me.update(i);
                });
            })();

            var c = me.initCanvas({}, 0, filterH),
                FA = me.getFullArc(); // full arc

            c.cx = c.w * 0.5;
            c.cy = (c.h-c.bpad+30) * (FA < TWO_PI ? 0.69 : 0.5); // 1:1 1.5:1
            c.or = Math.min(FA == TWO_PI ? (c.h-c.bpad+30) * 0.5 : c.h * 0.66, c.w * 0.35) - 3;
            c.ir = donut ? c.or * 0.3 : 0;
            c.or_sq = c.or * c.or;
            c.ir_sq = c.ir * c.ir;

            me.init();

            $('.tooltip').hide();

            me.__initialRow = row;
            me.update(row);

            // enable mouse events
            el.mousemove(_.bind(me.onMouseMove, me));
            me.renderingComplete();
        },

        /*
         * updates the chart according to the given row
         */
        update: function(row) {
            var me = this,
                dataset = me.dataset,
                groupAfter = me.groupAfter(),
                c = me.__canvas,
                donut = me.isDonut(),
                showTotal = donut && me.get('show-total', false),
                FA = me.getFullArc();

            me.__slices = me.__slices ? me.__slices : {};

            var column = me.axes(true).slices[row],
                labels = me.axes(true).labels,
                total = 0, min = Number.MAX_VALUE, max = 0,
                reverse,
                slices,
                others = 0,
                ocnt = 0,
                hasNegativeValues = column.range()[0] < 0,
                values = [],
                formatValue = me.chart().columnFormatter(column),
                formatLabel = me.chart().columnFormatter(labels);

            // pull values and labels from columns
            column.each(function(val, i) {
                values.push({
                    name: labels.val(i),
                    label: formatLabel(labels.val(i)),
                    value: val,
                    index: i
                });
            });

            // sort values by first slice column
            if (me.get('sort-values', true)) {
                values.sort(function(a, b) {
                    return me.axes(true).slices[0].val(b.index) -
                        me.axes(true).slices[0].val(a.index);
                });
            }

            // now group small series into one big chunk named 'others'
            slices = me.__values = [];
            _.each(values, function(o, i) {
                if (i < groupAfter || values.length <= groupAfter+1) slices.push(o);
                else {
                    ocnt += 1;
                    others += o.value;
                }
            });

            if (hasNegativeValues) {
                me.notify(me.translate('cannotShowNegativeValues'));
            }

            // add slice 'others' to the slices array
            if (ocnt > 0) {
                slices.push({ name: me.translate('other'), value: others });
                me.notify(me.translate('noMoreThanFiveSlices').replace('%count', ocnt));
            }

            if (me.get('sort-values', true)) {
                slices.sort(function(a,b) { return b.value - a.value; });
            }

            _.each(slices, function(s) {
                total += s.value;
                min = Math.min(min, s.value);
                max = Math.max(max, s.value);
            });
            reverse = min < total / slices.length * 0.66 || max > total/slices.length * 1.5;
            sa = -HALF_PI;
            if (reverse) sa += FA * (slices[0].value / total);

            if (FA < TWO_PI) {
                reverse = false;
                sa = -HALF_PI - FA * 0.5;
            } else {
                sa = -QUARTER_PI*0.8 - (slices[slices.length-1].value / total * Math.PI);
                reverse = true;
            }

            me.__seriesAngles = {};

            function normalize(a0, a1) {
                a0 += HALF_PI;
                a1 += HALF_PI;
                if (a0 < 0) {
                    a0 += TWO_PI;
                    a1 += TWO_PI;
                }
                return [a0, a1];
            }

            me.__sliceKeys = [];
            me.__sliceSet = c.paper.set();

            // remove old labels
            if (me.__out_labels) {
                _.each(me.__out_labels, function(lbl) {
                    lbl.el.animate({ opacity: 0 }, 200, function() {
                        if (lbl.data('line')) {
                            lbl.data('line').remove();
                        }
                        lbl.el.remove();
                    });
                });
            }
            me.__out_labels = [];

            var all_labels_inside = true,
                out_labels_max_width = c.w - c.or*2.3 - 60,
                out_labels_total_height = -20,
                num_labels_outside = 0,
                out_label_w = 0;

            function lblOutside(o) {
                // not available for election donuts (yet)
                if (me.getFullArc() < TWO_PI) return false;
                // this is a rough guess
                return o.name.length > 10 ? o.value / total < 0.15
                    : o.name.length > 5 ? o.value / total < 0.1 : false;
            }

            _.each(slices, function(o) {
                if (lblOutside(o)) {
                    all_labels_inside = false;
                    out_label_w = Math.max(
                        out_label_w,
                        Math.min(out_labels_max_width, me.labelWidth(o.name, 'series out'))
                    );
                    o.__lbl_h = me.labelHeight(o.name, 'series out', out_labels_max_width);
                    out_labels_total_height += o.__lbl_h + 20;
                    num_labels_outside++;
                }
            });

            var cx = c.cx - (all_labels_inside ? 0 : (out_label_w+50)*0.5),
                lbl_duration = _.keys(me.__slices).length > 0 ? me.theme().duration : 100;

            _.each(slices, function(o, index) {

                var da = o.value / total * FA,
                    fill = me.getKeyColor(o.name, 0),
                    stroke = chroma.color(fill).darken(15).hex(),
                    a0 = reverse ? sa - da : sa,
                    a1 = reverse ? sa : sa + da,
                    value = showTotal ? Math.round(o.value / total * 100)+'%' : formatValue(o.value, true);

                if (o.value === 0) return;

                me.__sliceKeys.push(o.name);

                if (!me.__slices[o.name]) {
                    // create new label
                    var lblcl = me.chart().hasHighlight() && me.chart().isHighlighted(o.name) ? 'series highlighted' : 'series';
                    if (me.invertLabel(fill)) lblcl += ' inverted';
                    if (lblOutside(o)) lblcl += ' outside';

                    var lbl = me.registerLabel(me.label(0, 0, '<b>'+o.name+'</b>'+value, {
                        w: 80, cl: lblcl, align: 'center', valign: 'middle'
                    }), o.name);

                    slice = me.__slices[o.name] = Slice(c.paper, cx, c.cy, c.or, c.ir, a0, a1, lbl, me.theme);
                    slice.path.attr({
                        'stroke': me.theme().colors.background,
                        'stroke-width': 2,
                        'fill': fill
                    });
                    slice.path.data('slice', slice);
                    me.__sliceSet.push(slice.path);
                    me.registerElement(slice.path, o.name);
                } else {
                    // update existing label
                    slice = me.__slices[o.name];
                    slice.label.text('<b>'+o.name+'</b>'+value);
                    slice.label[lblOutside(o) ? 'addClass' : 'removeClass']('outside');
                    slice.animate(cx, c.cy, c.or, c.ir, a0, a1, me.theme().duration, me.theme().easing);
                }

                me.__seriesAngles[o.name] = normalize(a0, a1);
                sa += reverse ? -da : da;

                if (lblOutside(o)) {
                    // add additional label
                    var lx = cx + c.or + 30,
                        ca = (me.__seriesAngles[o.name][0] + me.__seriesAngles[o.name][1]) * 0.5 - HALF_PI,
                        ly = c.cy + Math.sin(ca) * (c.or + 30),
                        out_lbl;

                    out_lbl = me.registerLabel(me.label(lx, ly, o.name, {
                        cl: 'series out',
                        w: out_label_w
                    }), o.name);

                    out_lbl.data('oy', ly)
                        .data('ca', ca)
                        .data('key', o.name)
                        .data('index', num_labels_outside - index)
                        .css({ opacity: 0 });

                    if (o.value / total <= 0.02) {
                        slice.label.hide();
                        out_lbl.text(out_lbl.text() + '&nbsp;(' + value +')');
                    } else {
                        slice.label.show();
                    }

                  me.__out_labels.push(out_lbl);
                }
            });

            if (me.__out_labels.length > 0) {
                me.optimizeLabelPositions(me.__out_labels, 5, 'top');
                // draw connecting lines
                _.each(me.__out_labels, function(lbl) {
                    var ly = +lbl.el.css('top').replace('px',''),
                        lx = +lbl.el.css('left').replace('px',''),
                        ca = lbl.data('ca'),
                        h = lbl.el.height(),
                        line;
                    function cxy(r) { return [cx + Math.cos(ca)*r, c.cy + Math.sin(ca)*r]; }
                    if (lbl.data('oy') > ly && lbl.data('oy') < h) {
                        line = c.paper.path('M'+cxy(c.or+4)+'L'+cxy(c.or+30)+'H'+(lx-5));
                    } else {
                        line = c.paper.path('M'+cxy(c.or+4)+'L'+cxy(c.or+8)+'L'+[lx-5, ly + h*0.5]);
                    }
                    me.registerElement(line, lbl.data('key'));
                    line.attr('opacity', 0);
                    lbl.el.data('line', line);

                    setTimeout(function() {
                        lbl.el.animate({ opacity: 1 }, 200);
                        line.animate({ opacity: 1 }, 200);
                    }, lbl_duration+lbl.data('index')*50);

                });
            }

            if (showTotal) {
                if (me.get('custom-total')) {
                    total = me.get('custom-total-value', '');
                } else {
                    total = formatValue(total, true);
                }
                if (me.__labelTotal) me.__labelTotal.remove();
                me.__labelTotal = me.label(cx, c.cy, '<strong>Total:</strong><br />'+total, {
                    w: 50,
                    align: 'center',
                    valign: 'middle'
                });
            }
        },

        getSeriesByPoint: function(x, y) {
            var me = this, c = me.__canvas, a, match;
            x -= c.root.offset().left + c.cx;
            y -= c.root.offset().top + c.cy;
            dist = x*x + y*y;
            if (dist > c.or_sq || dist < c.ir_sq) return false;
            a = Math.atan2(y, x) + HALF_PI;
            if (a < 0) a += TWO_PI;

            _.each(me.__seriesAngles, function(range, sname) {
                if (a >= range[0] && a < range[1]) {
                    match = sname;
                    return false;
                }
            });
            return _.find(me.__values, function(v) { return v.name() == match; });
        },

        getDataRowByPoint: function(x, y) {
            return 0;
        },

        showTooltip: function() {

        },

        hideTooltip: function() {

        },

        hover: function(hovered_key) {
            var me = this,
                bg = chroma.color(me.theme().colors.background);
            _.each(me.__sliceKeys, function(key) {
                _.each(me.__labels[key], function(lbl) {
                    if (!lbl) return;
                    if (hovered_key !== undefined && key == hovered_key) {
                        lbl.addClass('hover');
                    } else {
                        lbl.removeClass('hover');
                    }
                });
                _.each(me.__elements[key], function(el) {
                    var h = !hovered_key || key == hovered_key;
                    if (el.animate) el.animate({ opacity: h ? 1 : 0.5 }, 100);
                });
            });
        },

        unhoverSeries: function() {
            this.hoverSeries();
        },

        formatValue: function() {
            var me = this;
            return me.chart().columnFormatter(me.axes(true).slices);
            return me.formatValue.apply(me, arguments);
        },

    });

    var TWO_PI = Math.PI * 2,
        HALF_PI = Math.PI * 0.5,
        QUARTER_PI = Math.PI * 0.25;

    var Slice = function(paper, cx, cy, or, ir, startAngle, endAngle, label) {

        var me = {
            cx: cx,
            cy: cy,
            or: or,
            ir: ir,
            startAngle: startAngle,
            endAngle: endAngle
        };

        function arcPath() {
            var cx = me.cx, cy = me.cy, ir = me.ir, or = me.or,
                startAngle = me.startAngle, endAngle = me.endAngle;

            var x0 = cx+Math.cos(startAngle)*ir,
                y0 = cy+Math.sin(startAngle)*ir,
                x1 = cx+Math.cos(endAngle)*ir,
                y1 = cy+Math.sin(endAngle)*ir,
                x2 = cx+Math.cos(endAngle)*or,
                y2 = cy+Math.sin(endAngle)*or,
                x3 = cx+Math.cos(startAngle)*or,
                y3 = cy+Math.sin(startAngle)*or,
                largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

            if (ir > 0)
                return "M"+x0+" "+y0+" A"+ir+","+ir+" 0 "+largeArc+",1 "+x1+","+y1+" L"+x2+" "+y2+" A"+or+","+or+" 0 "+largeArc+",0 "+x3+" "+y3+" Z";
            else
                return "M"+cx+" "+cy+" L"+x2+" "+y2+" A"+or+","+or+" 0 "+largeArc+",0 "+x3+" "+y3+" Z";
        }

        function updateLabelPos() {
            var r = label.hasClass('outside') ? 0.8 : 0.65;
            lx = me.cx + Math.cos((me.startAngle + me.endAngle) * 0.5) * me.or * r,
            ly = me.cy + Math.sin((me.startAngle + me.endAngle) * 0.5) * me.or * r;
            label.attr({ x: lx, y: ly });
        }

        var running;
        function frame() {
            path.attr({ path: arcPath() }).attr('stroke-linejoin', 'round');
            updateLabelPos();
            if (running) requestAnimationFrame(frame);
        }

        var path = paper.path(arcPath());
        updateLabelPos();

        return {
            // slice arc path
            path: path,
            // html label element
            label: label,
            // a function to animate slice to new state
            animate: function(cx, cy, or, ir, sa, ea, duration, easing) {
                running = true;
                $(me).animate(
                    { cx: cx, cy: cy, or: or, ir: ir, startAngle: sa, endAngle: ea },
                    { easing: easing, duration: duration, complete: function() {
                        running = false;
                        frame();
                    }
                });
                requestAnimationFrame(frame);
            },

            startAngle: function() { return me.startAngle; },
            endAngle: function() { return me.endAngle; },
            midAngle: function() { return (me.startAngle + me.endAngle) * 0.5; }
        };
    };

}).call(this);