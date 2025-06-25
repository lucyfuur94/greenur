interface WateringRecommendation {
  isOptimal: boolean;
  score: number; // 0-100, higher is better
  reason: string;
  shouldWater: boolean;
  confidence: 'high' | 'medium' | 'low';
}

interface OptimalWateringWindow {
  startTime: string; // "6:00 AM"
  endTime: string; // "8:00 AM"
  datetime: string; // ISO string
  score: number;
  reason: string;
  priority: 'best' | 'good' | 'acceptable';
}

interface DailyWateringSchedule {
  date: string;
  recommended: boolean;
  reason: string;
  optimalWindows: OptimalWateringWindow[];
  avoidTimes: string[];
  rainProbability: number;
  temperature: number;
  humidity: number;
}

class WateringRecommendationService {
  // Core scoring factors
  private readonly OPTIMAL_TEMP_RANGE = { min: 15, max: 25 }; // °C
  private readonly OPTIMAL_HUMIDITY_RANGE = { min: 40, max: 70 }; // %
  private readonly LIGHT_RAIN_THRESHOLD = 1.0; // mm - light rain, reduce watering
  private readonly MODERATE_RAIN_THRESHOLD = 3.0; // mm - moderate rain, skip watering
  private readonly HIGH_WIND_THRESHOLD = 15; // km/h

  // Time-based preferences
  private readonly OPTIMAL_TIMES = [
    { start: 6, end: 8, name: "Early Morning", score: 100 },
    { start: 18, end: 20, name: "Early Evening", score: 85 }
  ];
  
  private readonly AVOID_TIMES = [
    { start: 11, end: 15, name: "Midday Heat", reason: "High evaporation rate" },
    { start: 21, end: 5, name: "Night", reason: "Fungal disease risk" }
  ];

  /**
   * Analyze weather conditions and return watering recommendation for current time
   */
  analyzeCurrentConditions(weatherData: any): WateringRecommendation {
    const { current, hourlyForecast } = weatherData;
    let score = 50; // Base score
    let reasons: string[] = [];
    let shouldWater = true;

    // Temperature analysis
    if (current.temp >= this.OPTIMAL_TEMP_RANGE.min && current.temp <= this.OPTIMAL_TEMP_RANGE.max) {
      score += 20;
      reasons.push("Good temperature for watering");
    } else if (current.temp > 30) {
      score -= 25;
      reasons.push("Very hot - water will evaporate quickly");
    } else if (current.temp < 10) {
      score -= 15;
      reasons.push("Cool temperature - plants need less water");
    }

    // Humidity analysis
    if (current.humidity >= this.OPTIMAL_HUMIDITY_RANGE.min && current.humidity <= this.OPTIMAL_HUMIDITY_RANGE.max) {
      score += 15;
      reasons.push("Ideal humidity levels");
    } else if (current.humidity > 80) {
      score -= 10;
      reasons.push("High humidity - reduced evaporation");
    } else if (current.humidity < 30) {
      score += 10;
      reasons.push("Low humidity - plants may need extra water");
    }

    // Rain analysis - more nuanced approach
    if (current.condition === 'rain') {
      // For current conditions, we need to check precipitation from hourly forecast
      // since current doesn't have precipitation amount
      const currentHourData = hourlyForecast?.[0];
      const currentPrecipitation = currentHourData?.precipitation || 0;
      
      if (currentPrecipitation >= this.MODERATE_RAIN_THRESHOLD) {
        score -= 40;
        shouldWater = false;
        reasons.push(`Moderate/heavy rain (${currentPrecipitation}mm) - skip watering`);
      } else if (currentPrecipitation >= this.LIGHT_RAIN_THRESHOLD) {
        score -= 20;
        reasons.push(`Light rain (${currentPrecipitation}mm) - reduce watering need`);
      } else {
        score -= 10;
        reasons.push(`Very light rain (${currentPrecipitation}mm) - monitor conditions`);
      }
    }

    // Wind analysis
    if (current.windSpeed > this.HIGH_WIND_THRESHOLD) {
      score -= 15;
      reasons.push("High winds - water may not reach roots effectively");
    }

    // Time-based analysis
    const currentHour = new Date().getHours();
    const timeAnalysis = this.analyzeTimeOfDay(currentHour);
    score += timeAnalysis.adjustment;
    if (timeAnalysis.reason) {
      reasons.push(timeAnalysis.reason);
    }

    // Confidence calculation
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (score >= 75) confidence = 'high';
    else if (score <= 40) confidence = 'low';

    return {
      isOptimal: score >= 70 && shouldWater,
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.join('. '),
      shouldWater,
      confidence
    };
  }

  /**
   * Generate optimal watering windows for today based on hourly forecast
   */
  generateOptimalWindows(weatherData: any): OptimalWateringWindow[] {
    const { hourlyForecast } = weatherData;
    const windows: OptimalWateringWindow[] = [];

    if (!hourlyForecast || !Array.isArray(hourlyForecast)) {
      return this.getFallbackWindows();
    }

    hourlyForecast.forEach((hourData) => {
      const date = new Date(hourData.datetime);
      const hour = date.getHours();
      
      // Check if this hour falls in preferred time slots
      const timeSlot = this.OPTIMAL_TIMES.find(slot => hour >= slot.start && hour < slot.end);
      if (!timeSlot) return;

      let score = timeSlot.score;
      let reasons: string[] = [`${timeSlot.name} watering time`];

      // Adjust score based on weather conditions
      if (hourData.precipitation >= this.MODERATE_RAIN_THRESHOLD) {
        score -= 50;
        reasons.push("Heavy rain expected");
      } else if (hourData.precipitation >= this.LIGHT_RAIN_THRESHOLD) {
        score -= 25;
        reasons.push("Light rain expected");
      } else if (hourData.precipitation > 0) {
        score -= 10;
        reasons.push("Very light rain possible");
      }

      if (hourData.temp >= this.OPTIMAL_TEMP_RANGE.min && hourData.temp <= this.OPTIMAL_TEMP_RANGE.max) {
        score += 10;
      } else if (hourData.temp > 30) {
        score -= 20;
        reasons.push("Very hot temperature");
      }

      if (hourData.humidity >= this.OPTIMAL_HUMIDITY_RANGE.min && hourData.humidity <= this.OPTIMAL_HUMIDITY_RANGE.max) {
        score += 5;
      }

      if (hourData.windSpeed > this.HIGH_WIND_THRESHOLD) {
        score -= 10;
        reasons.push("High winds");
      }

      // Only include if score is decent
      if (score >= 50) {
        windows.push({
          startTime: this.formatTime(hour),
          endTime: this.formatTime(hour + 1),
          datetime: hourData.datetime,
          score: Math.max(0, Math.min(100, score)),
          reason: reasons.join(', '),
          priority: score >= 85 ? 'best' : score >= 70 ? 'good' : 'acceptable'
        });
      }
    });

    // Sort by score (best first)
    return windows.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate 5-day watering schedule based on daily forecast
   */
  generateWeeklySchedule(weatherData: any): DailyWateringSchedule[] {
    const { dailyForecast } = weatherData;
    const schedule: DailyWateringSchedule[] = [];

    if (!dailyForecast || !Array.isArray(dailyForecast)) {
      return [];
    }

    dailyForecast.forEach((dayData) => {
      let recommended = true;
      let reasons: string[] = [];
      let rainProbability = 0;

      // Check for rain - more nuanced approach
      if (dayData.condition === 'rain') {
        if (dayData.description.includes('heavy') || dayData.description.includes('moderate')) {
          recommended = false;
          reasons.push("Heavy/moderate rain expected");
          rainProbability = 85;
        } else {
          // Light rain - reduce watering but don't skip entirely
          reasons.push("Light rain expected - reduce watering amount");
          rainProbability = 60;
        }
      } else if (dayData.description.includes('rain')) {
        rainProbability = 40;
        if (dayData.description.includes('heavy') || dayData.description.includes('moderate')) {
          recommended = false;
          reasons.push("Heavy rain possible");
          rainProbability = 70;
        } else {
          reasons.push("Light rain possible - monitor conditions");
        }
      }

      // Temperature analysis
      const avgTemp = (dayData.min + dayData.max) / 2;
      if (avgTemp > 35) {
        reasons.push("Very hot day - water early morning");
      } else if (avgTemp < 5) {
        recommended = false;
        reasons.push("Very cold - plants dormant");
      }

      // Humidity analysis
      if (dayData.humidity > 85) {
        reasons.push("High humidity - reduced watering need");
      } else if (dayData.humidity < 30) {
        reasons.push("Low humidity - may need extra water");
      }

      // Generate optimal windows for this day (simplified)
      const optimalWindows = this.generateDayWindows(dayData);

      schedule.push({
        date: dayData.date,
        recommended,
        reason: reasons.length > 0 ? reasons.join('. ') : "Good conditions for watering",
        optimalWindows,
        avoidTimes: this.getAvoidTimes(dayData),
        rainProbability,
        temperature: avgTemp,
        humidity: dayData.humidity
      });
    });

    return schedule;
  }

  /**
   * Check if current time is in an optimal watering window
   */
  isCurrentTimeOptimal(weatherData: any): { isOptimal: boolean; window?: OptimalWateringWindow; nextWindow?: OptimalWateringWindow } {
    const windows = this.generateOptimalWindows(weatherData);
    const now = new Date();
    const currentHour = now.getHours();

    // Check if we're currently in an optimal window
    const currentWindow = windows.find(window => {
      const windowDate = new Date(window.datetime);
      const windowHour = windowDate.getHours();
      return windowHour === currentHour;
    });

    if (currentWindow) {
      return { isOptimal: true, window: currentWindow };
    }

    // Find next optimal window
    const nextWindow = windows.find(window => {
      const windowDate = new Date(window.datetime);
      return windowDate > now;
    });

    return { isOptimal: false, nextWindow };
  }

  // Helper methods
  private analyzeTimeOfDay(hour: number): { adjustment: number; reason?: string } {
    // Check optimal times
    for (const optimal of this.OPTIMAL_TIMES) {
      if (hour >= optimal.start && hour < optimal.end) {
        return { adjustment: 20, reason: `${optimal.name} - ideal watering time` };
      }
    }

    // Check avoid times
    for (const avoid of this.AVOID_TIMES) {
      if ((avoid.start <= avoid.end && hour >= avoid.start && hour < avoid.end) ||
          (avoid.start > avoid.end && (hour >= avoid.start || hour < avoid.end))) {
        return { adjustment: -30, reason: `${avoid.name} - ${avoid.reason}` };
      }
    }

    return { adjustment: 0 };
  }

  private formatTime(hour: number): string {
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  }

  private getFallbackWindows(): OptimalWateringWindow[] {
    const today = new Date();
    return this.OPTIMAL_TIMES.map(slot => ({
      startTime: this.formatTime(slot.start),
      endTime: this.formatTime(slot.end),
      datetime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), slot.start).toISOString(),
      score: slot.score,
      reason: `${slot.name} - ideal watering time`,
      priority: slot.score >= 85 ? 'best' : 'good'
    }));
  }

  private generateDayWindows(dayData: any): OptimalWateringWindow[] {
    return this.OPTIMAL_TIMES.map(slot => {
      let score = slot.score;
      const reasons = [`${slot.name} watering`];

      // Adjust based on day conditions
      if (dayData.condition === 'rain') {
        score -= 40;
        reasons.push("rain expected");
      }

      const avgTemp = (dayData.min + dayData.max) / 2;
      if (avgTemp > 30) {
        score -= 15;
        reasons.push("hot day");
      }

      const date = new Date(dayData.date);
      const finalScore = Math.max(0, score);
      return {
        startTime: this.formatTime(slot.start),
        endTime: this.formatTime(slot.end),
        datetime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), slot.start).toISOString(),
        score: finalScore,
        reason: reasons.join(', '),
        priority: (finalScore >= 85 ? 'best' : finalScore >= 70 ? 'good' : 'acceptable') as 'best' | 'good' | 'acceptable'
      };
    }).filter(window => window.score >= 50);
  }

  private getAvoidTimes(dayData: any): string[] {
    const avoidTimes = ["11:00 AM - 3:00 PM (Midday heat)"];
    
    if (dayData.condition === 'rain') {
      avoidTimes.push("All day (Rain expected)");
    }
    
    return avoidTimes;
  }
}

export const wateringRecommendationService = new WateringRecommendationService();
export type { WateringRecommendation, OptimalWateringWindow, DailyWateringSchedule }; 