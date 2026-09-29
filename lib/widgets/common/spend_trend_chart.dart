import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../state/app_currency.dart';

/// A single line chart of spend-per-day, styled with the app's own theme
/// (color, type) rather than fl_chart's raw defaults — used by Dashboard's
/// "Spend trend" card.
class SpendTrendChart extends StatelessWidget {
  final List<(DateTime, double)> points;

  const SpendTrendChart({super.key, required this.points});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final currency = compactCurrencyFormat();

    if (points.length < 2) {
      // A single point (or none) can't draw a meaningful line — the caller
      // decides whether to show this widget at all; this is just a safe
      // fallback so it never crashes on a sparse dataset.
      return Center(
        child: Text(
          "Not enough data yet",
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }

    final maxY = points
        .map((p) => p.$2)
        .fold<double>(0, (a, b) => a > b ? a : b);
    final spots = [
      for (var i = 0; i < points.length; i++)
        FlSpot(i.toDouble(), points[i].$2),
    ];
    final labelEvery = (points.length / 5).ceil().clamp(1, points.length);
    final effectiveMaxY = maxY == 0 ? 1.0 : maxY * 1.2;

    return LineChart(
      LineChartData(
        minY: 0,
        maxY: effectiveMaxY,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: effectiveMaxY / 4,
          getDrawingHorizontalLine: (_) => FlLine(
            color: scheme.outlineVariant.withValues(alpha: 0.4),
            strokeWidth: 1,
          ),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 44,
              getTitlesWidget: (value, meta) => Text(
                currency.format(value),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              interval: labelEvery.toDouble(),
              getTitlesWidget: (value, meta) {
                final i = value.round();
                if (i < 0 || i >= points.length) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    DateFormat.Md().format(points[i].$1),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                );
              },
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (spots) => spots.map((s) {
              final i = s.x.round();
              final date = i >= 0 && i < points.length
                  ? DateFormat.yMMMd().format(points[i].$1)
                  : "";
              return LineTooltipItem(
                "$date\n${currency.format(s.y)}",
                const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              );
            }).toList(),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: scheme.primary,
            barWidth: 3,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  scheme.primary.withValues(alpha: 0.25),
                  scheme.primary.withValues(alpha: 0.0),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
