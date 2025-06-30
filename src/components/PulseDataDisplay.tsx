import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPulseData, getRelativeTime } from '@/lib/services/pulseDataService';
import { checkDeviceStatus, getStatusDisplay } from '@/lib/services/deviceStatusService';
import { updateDeviceThreshold } from '@/lib/services/thresholdService';
import { Wifi, Activity, RefreshCw, AlertCircle, Calendar, ChevronLeft, ChevronRight, Droplets, Settings, Save, Plus, Minus } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PulseDataPoint {
  _id: string;
  deviceId: string;
  timestamp: string;
  lightLevel?: number;
  temperature?: number;
  humidity?: number;
  soilMoisture?: number;
  isWaterOn?: number; // 1 for on, 0 for off
  threshold?: number;
  sourceIp?: string;
}

interface PulseDataDisplayProps {
  deviceId: string;
  deviceName?: string;
}

export const PulseDataDisplay: React.FC<PulseDataDisplayProps> = ({ deviceId, deviceName }) => {
  const [data, setData] = useState<PulseDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({start: null, end: null});
  const [selectedQuickOption, setSelectedQuickOption] = useState<string>('last7');
  
  // New state for threshold management
  const [tempThreshold, setTempThreshold] = useState<number>(30);
  const [thresholdUpdateLoading, setThresholdUpdateLoading] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [waterControlLoading, setWaterControlLoading] = useState(false);

  // Quick date selection options
  const quickOptions = [
    { label: 'Custom', value: 'custom' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 days', value: 'last7' },
    { label: 'Last 30 days', value: 'last30' },
    { label: 'Last 60 days', value: 'last60' },
    { label: 'Last 90 days', value: 'last90' },
  ];

  const getQuickOptionDisplayText = () => {
    const option = quickOptions.find(opt => opt.value === selectedQuickOption);
    return option?.label || 'Custom';
  };

  const fetchData = async (startDate?: Date, endDate?: Date) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch pulse data and device status in parallel
      const [dataResponse, statusResponse] = await Promise.all([
        getPulseData(deviceId, startDate, endDate),
        checkDeviceStatus(deviceId)
      ]);

      if (dataResponse.success && dataResponse.data) {
        setData(dataResponse.data);
        setLastRefresh(new Date());
      } else {
        setError(dataResponse.error || 'Failed to fetch data');
      }

      if (statusResponse.success) {
        setDeviceStatus(statusResponse);
      } else {
        console.error('Failed to fetch device status:', statusResponse.error);
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initialize with Last 7 days by default
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    // Set proper time ranges
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start of day 7 days ago
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999); // End of today
    
    setSelectedStartDate(sevenDaysAgo);
    setSelectedEndDate(todayEnd);
    setDateRange({start: sevenDaysAgo, end: todayEnd});
    
    fetchData(sevenDaysAgo, todayEnd);
  }, [deviceId]);

  // Separate useEffect for auto-refresh to honor current date range
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        // Use current date range for auto-refresh
        const currentStart = dateRange.start;
        const currentEnd = dateRange.end;
        fetchData(currentStart || undefined, currentEnd || undefined);
      }, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, dateRange]);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const isDateRangeStart = (day: number) => {
    if (!selectedStartDate) return false;
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return date.toDateString() === selectedStartDate.toDateString();
  };

  const isDateRangeEnd = (day: number) => {
    if (!selectedEndDate) return false;
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return date.toDateString() === selectedEndDate.toDateString();
  };

  const isDateInRange = (day: number) => {
    if (!selectedStartDate || !selectedEndDate) return false;
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    return date > selectedStartDate && date < selectedEndDate;
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    
    // Prevent selection of future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today to allow today's selection
    if (clickedDate > today) {
      return; // Don't allow future date selection
    }
    
    // Switch to custom mode when manually selecting dates
    setSelectedQuickOption('custom');
    
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Start new selection
      setSelectedStartDate(clickedDate);
      setSelectedEndDate(null);
    } else if (selectedStartDate && !selectedEndDate) {
      // Complete the range
      if (clickedDate >= selectedStartDate) {
        setSelectedEndDate(clickedDate);
      } else {
        setSelectedStartDate(clickedDate);
        setSelectedEndDate(selectedStartDate);
      }
    }
  };

  const handleApplyDateRange = () => {
    if (selectedStartDate && selectedEndDate) {
      // Create proper date ranges for the selected dates
      const startDate = new Date(selectedStartDate);
      startDate.setHours(0, 0, 0, 0); // Start of day
      
      const endDate = new Date(selectedEndDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      setDateRange({start: startDate, end: endDate});
      fetchData(startDate, endDate);
    } else if (selectedStartDate) {
      const startDate = new Date(selectedStartDate);
      startDate.setHours(0, 0, 0, 0); // Start of day
      
      const endDate = new Date(selectedStartDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      setDateRange({start: startDate, end: endDate});
      fetchData(startDate, endDate);
    }
    setShowCalendar(false);
  };

  const handleCancelDateSelection = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setShowCalendar(false);
  };

  const renderCalendar = () => {
    const handleQuickSelect = (value: string) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      setSelectedQuickOption(value);
      
      switch (value) {
        case 'today':
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          setSelectedStartDate(todayStart);
          setSelectedEndDate(todayEnd);
          setDateRange({start: todayStart, end: todayEnd});
          fetchData(todayStart, todayEnd);
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStart = new Date(yesterday);
          yesterdayStart.setHours(0, 0, 0, 0);
          const yesterdayEnd = new Date(yesterday);
          yesterdayEnd.setHours(23, 59, 59, 999);
          setSelectedStartDate(yesterdayStart);
          setSelectedEndDate(yesterdayEnd);
          setDateRange({start: yesterdayStart, end: yesterdayEnd});
          fetchData(yesterdayStart, yesterdayEnd);
          break;
        case 'last7':
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          const todayLast7End = new Date(today);
          todayLast7End.setHours(23, 59, 59, 999);
          setSelectedStartDate(sevenDaysAgo);
          setSelectedEndDate(todayLast7End);
          setDateRange({start: sevenDaysAgo, end: todayLast7End});
          fetchData(sevenDaysAgo, todayLast7End);
          break;
        case 'last30':
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          const todayLast30End = new Date(today);
          todayLast30End.setHours(23, 59, 59, 999);
          setSelectedStartDate(thirtyDaysAgo);
          setSelectedEndDate(todayLast30End);
          setDateRange({start: thirtyDaysAgo, end: todayLast30End});
          fetchData(thirtyDaysAgo, todayLast30End);
          break;
        case 'last60':
          const sixtyDaysAgo = new Date(today);
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 59);
          sixtyDaysAgo.setHours(0, 0, 0, 0);
          const todayLast60End = new Date(today);
          todayLast60End.setHours(23, 59, 59, 999);
          setSelectedStartDate(sixtyDaysAgo);
          setSelectedEndDate(todayLast60End);
          setDateRange({start: sixtyDaysAgo, end: todayLast60End});
          fetchData(sixtyDaysAgo, todayLast60End);
          break;
        case 'last90':
          const ninetyDaysAgo = new Date(today);
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
          ninetyDaysAgo.setHours(0, 0, 0, 0);
          const todayLast90End = new Date(today);
          todayLast90End.setHours(23, 59, 59, 999);
          setSelectedStartDate(ninetyDaysAgo);
          setSelectedEndDate(todayLast90End);
          setDateRange({start: ninetyDaysAgo, end: todayLast90End});
          fetchData(ninetyDaysAgo, todayLast90End);
          break;
        case 'custom':
        default:
          // For custom, clear selections and let user select manually
          setSelectedStartDate(null);
          setSelectedEndDate(null);
          break;
      }
    };

    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarMonth);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today
      const isFutureDate = currentDate > today;
      
      const isStart = isDateRangeStart(day);
      const isEnd = isDateRangeEnd(day);
      const isInRange = isDateInRange(day);
      
      let buttonClass = "w-8 h-8 text-xs flex items-center justify-center transition-colors relative ";
      
      if (isFutureDate) {
        // Future dates - disabled
        buttonClass += "text-gray-300 cursor-not-allowed";
      } else if (isStart && isEnd) {
        // Single day selection
        buttonClass += "bg-blue-500 text-white rounded-full";
      } else if (isStart) {
        // Start of range
        buttonClass += "bg-blue-500 text-white rounded-l-full";
      } else if (isEnd) {
        // End of range  
        buttonClass += "bg-blue-500 text-white rounded-r-full";
      } else if (isInRange) {
        // Middle of range
        buttonClass += "bg-blue-100 text-blue-700";
      } else {
        // Not selected
        buttonClass += "hover:bg-gray-100 text-gray-700 rounded-full";
      }
      
      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(day)}
          className={buttonClass}
          disabled={isFutureDate}
        >
          {day}
        </button>
      );
    }
    
    return (
                          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg shadow-xl z-[9999] min-w-[480px] max-h-[500px] overflow-hidden">
        <div className="flex">
          {/* Quick selection sidebar */}
          <div className="w-32 border-r border-gray-200 p-2">
            <div className="space-y-1">
              {quickOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleQuickSelect(option.value)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                    selectedQuickOption === option.value
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Calendar section */}
          <div className="flex-1 p-3">
            {/* Start Date - End Date Header */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-700">Start date</label>
                <div className="px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50">
                  {selectedStartDate ? selectedStartDate.toLocaleDateString() : 'Select date'}
                </div>
              </div>
              <span className="text-gray-400 text-xs">—</span>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-700">End date</label>
                <div className="px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50">
                  {selectedEndDate ? selectedEndDate.toLocaleDateString() : 'Select date'}
                </div>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-medium">{formatDate(calendarMonth)}</h3>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <div key={day} className="w-8 h-6 text-xs text-gray-500 flex items-center justify-center font-medium">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {days}
            </div>
          </div>
        </div>
        
        {/* Apply/Cancel buttons - Footer */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            {selectedQuickOption !== 'custom' && (
              <span>Selected: {getQuickOptionDisplayText()}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelDateSelection}
              className="text-xs px-3 py-1 h-auto"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyDateRange}
              disabled={selectedQuickOption === 'custom' && !selectedStartDate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1 h-auto"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (!data || data.length === 0) return null;

    // Get last 48 data points for chart (more data for water analysis)
    const chartData = data.slice(0, 48).reverse();
    
    // Prepare water on periods for area highlighting
    const waterOnData = chartData.map(point => point.isWaterOn === 1 ? 100 : 0);
    
    const chartConfig = {
      labels: chartData.map((point) => {
        const date = new Date(point.timestamp);
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        });
      }),
      datasets: [
        {
          label: 'Soil Moisture %',
          data: chartData.map(point => point.soilMoisture || 0),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.1,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#10B981',
          pointRadius: 2,
          pointHoverRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Threshold',
          data: chartData.map(point => point.threshold || 30),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5], // Dotted line
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'Water On',
          data: waterOnData,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 0.4)',
          borderWidth: 1,
          fill: 'origin',
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          yAxisID: 'y1',
          stepped: true,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Soil Moisture & Watering Activity',
          font: {
            size: 16,
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: '#ffffff',
          titleColor: '#000000',
          bodyColor: '#000000',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          callbacks: {
            label: function(context: any) {
              if (context.datasetIndex === 0) {
                return `Soil Moisture: ${context.parsed.y}%`;
              } else if (context.datasetIndex === 1) {
                return `Threshold: ${context.parsed.y}%`;
              } else if (context.datasetIndex === 2) {
                return context.parsed.y ? 'Water: ON' : '';
              }
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Time'
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)',
          },
          ticks: {
            maxTicksLimit: 8,
          },
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: true,
            text: 'Soil Moisture %'
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)',
          },
          min: 0,
          max: 100,
        },
        y1: {
          type: 'linear' as const,
          display: false,
          position: 'right' as const,
          min: 0,
          max: 100,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    };

    return (
      <div className="w-full h-80 bg-card rounded-lg p-4 border border-border">
        <Line data={chartConfig} options={options} />
      </div>
    );
  };

  // Get status display info from the API response
  const statusDisplay = deviceStatus ? getStatusDisplay(deviceStatus.status || 'offline') : getStatusDisplay('offline');

  // Threshold management functions
  const handleThresholdEdit = () => {
    const latestThreshold = data.length > 0 ? data[0].threshold : 30;
    setTempThreshold(latestThreshold || 30);
    setShowThresholdModal(true);
    setThresholdError(null);
  };

  const handleThresholdSave = async () => {
    setThresholdUpdateLoading(true);
    setThresholdError(null);
    
    try {
      const result = await updateDeviceThreshold(deviceId, tempThreshold);
      if (result.success) {
        setShowThresholdModal(false);
        // Refresh data to show updated threshold
        fetchData(dateRange.start || undefined, dateRange.end || undefined);
      } else {
        setThresholdError(result.error || 'Failed to update threshold');
      }
    } catch (error) {
      setThresholdError('Network error occurred');
    } finally {
      setThresholdUpdateLoading(false);
    }
  };

  const handleThresholdCancel = () => {
    setShowThresholdModal(false);
    setThresholdError(null);
  };

  const adjustThreshold = (delta: number) => {
    const newValue = Math.max(0, Math.min(100, tempThreshold + delta));
    setTempThreshold(newValue);
  };

  // Get latest values for KPIs
  const getLatestSoilMoisture = () => {
    return data.length > 0 ? data[0].soilMoisture || 0 : 0;
  };

  const getLatestThreshold = () => {
    return data.length > 0 ? data[0].threshold || 30 : 30;
  };



  // Water control function
  const handleWaterToggle = async () => {
    setWaterControlLoading(true);
    
    try {
      // For now, this is a placeholder - you'll need to implement the actual water control API
      // const result = await toggleWater(deviceId, !getCurrentWaterStatus());
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh data after water control
      fetchData(dateRange.start || undefined, dateRange.end || undefined);
    } catch (error) {
      console.error('Error controlling water:', error);
    } finally {
      setWaterControlLoading(false);
    }
  };

  const getCurrentWaterStatus = () => {
    return data.length > 0 && data[0].isWaterOn === 1;
  };

  if (loading && !data.length) {
    return (
      <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
        <CardHeader>
          <CardTitle className="flex items-center text-card-foreground">
            <Activity className="w-5 h-5 mr-2" />
            Loading Device Data...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Device Status Card */}
      <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-card-foreground">
            <button
              onClick={() => setShowDeviceInfo(true)}
              className="flex items-center mr-2 p-1 rounded-full hover:bg-accent transition-colors"
            >
              <Wifi 
                className={`w-5 h-5 ${
                  deviceStatus?.online ? 'text-green-500' : 'text-muted-foreground'
                }`} 
              />
            </button>
            {deviceName || deviceId}
          </CardTitle>
        </CardHeader>
        <CardContent>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Chart Controls - Always visible */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {selectedQuickOption !== 'custom' ? (
                    getQuickOptionDisplayText()
                  ) : dateRange.start && dateRange.end ? (
                    `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                  ) : (
                    'Custom Date Range'
                  )}
                </Button>
                {showCalendar && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
                      onClick={() => setShowCalendar(false)}
                    ></div>
                    {renderCalendar()}
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Auto-refresh</label>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    autoRefresh ? 'bg-green-500' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${
                      autoRefresh ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <Button 
                onClick={() => fetchData(dateRange.start || undefined, dateRange.end || undefined)} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* High-level KPIs - Compact for mobile */}
          {data.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
              {/* Soil Moisture KPI */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-2 sm:p-4">
                  <div className="text-center">
                    <Droplets className="w-4 h-4 sm:w-6 sm:h-6 mx-auto text-green-600 mb-1" />
                    <p className="text-xs sm:text-sm font-medium text-green-700">Soil</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-900">{getLatestSoilMoisture()}%</p>
                  </div>
                </CardContent>
              </Card>

              {/* Threshold KPI - Interactive */}
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300 border-2 shadow-md">
                <CardContent className="p-2 sm:p-4">
                  <div className="text-center">
                    <button
                      onClick={handleThresholdEdit}
                      className="w-full hover:bg-amber-200 rounded-lg transition-colors p-1"
                    >
                      <Settings className="w-4 h-4 sm:w-6 sm:h-6 mx-auto text-amber-600 mb-1" />
                      <p className="text-xs sm:text-sm font-medium text-amber-700">Threshold</p>
                      <p className="text-lg sm:text-2xl font-bold text-amber-900">{getLatestThreshold()}%</p>
                      <p className="text-xs text-amber-600 mt-1">Tap to edit</p>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Water Control KPI - Interactive */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 border-2 shadow-md">
                <CardContent className="p-2 sm:p-4">
                  <div className="text-center">
                    <div className={`w-4 h-4 sm:w-6 sm:h-6 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      getCurrentWaterStatus() ? 'bg-blue-600' : 'bg-gray-400'
                    }`}>
                      <Droplets className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-blue-700">Water</p>
                    <p className="text-sm sm:text-base font-bold text-blue-900 leading-tight mb-2">
                      {getCurrentWaterStatus() ? 'ON' : 'OFF'}
                    </p>
                    <button
                      onClick={handleWaterToggle}
                      disabled={waterControlLoading}
                      className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors ${
                        getCurrentWaterStatus() 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      } disabled:opacity-50`}
                    >
                      {waterControlLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin mx-auto" />
                      ) : (
                        getCurrentWaterStatus() ? 'Turn OFF' : 'Turn ON'
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chart or No Data Message */}
          {data.length > 0 ? (
            renderChart()
          ) : (
            <div className="text-center py-8 bg-muted rounded-lg">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground">No data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                No data found for the selected date range
              </p>
            </div>
          )}

          {/* Last Update Info */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Device Info Overlay */}
      {showDeviceInfo && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
            onClick={() => setShowDeviceInfo(false)}
          ></div>
          
          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-xl z-[10000] w-80 max-w-[90vw] p-6 border border-border">
            <div className="text-center">
              {/* Device Icon */}
              <div className="flex justify-center mb-4">
                <div className={`p-4 rounded-full ${deviceStatus?.online ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-muted'}`}>
                  <Wifi className={`w-8 h-8 ${deviceStatus?.online ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
              </div>
              
              {/* Device Name */}
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {deviceName || deviceId}
              </h3>
              
              {/* Status */}
              <div className="mb-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  deviceStatus?.online 
                    ? 'bg-green-500/10 text-green-800 dark:bg-green-500/20 dark:text-green-200' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    deviceStatus?.online ? 'bg-green-500' : 'bg-muted-foreground'
                  }`}></div>
                  {statusDisplay.text}
                </div>
              </div>
              
              {/* Device Details */}
              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Last Seen</span>
                  <span className="text-sm font-medium text-foreground">
                    {deviceStatus?.lastSeen ? getRelativeTime(deviceStatus.lastSeen) : 'Unknown'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Device ID</span>
                  <span className="text-sm font-mono text-foreground break-all">
                    {deviceId}
                  </span>
                </div>
                
                {data.length > 0 && data[0].soilMoisture && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Latest Soil Moisture</span>
                    <span className="text-sm font-medium text-foreground">
                      {data[0].soilMoisture}%
                    </span>
                  </div>
                )}
                
                {data.length > 0 && typeof data[0].isWaterOn === 'number' && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Water Status</span>
                    <span className={`text-sm font-medium ${data[0].isWaterOn === 1 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      {data[0].isWaterOn === 1 ? 'ON' : 'OFF'}
                    </span>
                  </div>
                )}
                
                {data.length > 0 && data[0].threshold && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Current Threshold</span>
                    <span className="text-sm font-medium text-foreground">
                      {data[0].threshold}%
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Connection Status</span>
                  <span className="text-sm text-foreground">
                    {deviceStatus?.online ? 'Connected' : statusDisplay.description || 'Disconnected'}
                  </span>
                </div>
              </div>
              
              {/* Close Button */}
              <button
                onClick={() => setShowDeviceInfo(false)}
                className="mt-6 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Threshold Editing Modal */}
      {showThresholdModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
            onClick={handleThresholdCancel}
          ></div>
          
          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-xl z-[10000] w-80 max-w-[90vw] p-6 border border-border">
            <div className="text-center">
              {/* Modal Header */}
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-amber-500/10 dark:bg-amber-500/20">
                  <Settings className="w-8 h-8 text-amber-600" />
                </div>
              </div>
              
              {/* Modal Title */}
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Set Watering Threshold
              </h3>
              
              <p className="text-sm text-muted-foreground mb-6">
                Water will turn on when soil moisture drops below this level
              </p>
              
              {/* Threshold Controls */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustThreshold(-1)}
                    className="h-12 w-12 p-0 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={tempThreshold}
                      onChange={(e) => setTempThreshold(Number(e.target.value))}
                      className="w-24 h-12 text-center text-xl font-bold pr-8"
                    />
                    <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-lg font-medium text-muted-foreground">%</span>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustThreshold(1)}
                    className="h-12 w-12 p-0 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Quick preset buttons */}
                <div className="flex justify-center gap-2 mb-4">
                  {[20, 30, 40, 50].map((preset) => (
                    <Button
                      key={preset}
                      size="sm"
                      variant={tempThreshold === preset ? "default" : "outline"}
                      onClick={() => setTempThreshold(preset)}
                      className="text-xs"
                    >
                      {preset}%
                    </Button>
                  ))}
                </div>
                
                {/* Error message */}
                {thresholdError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700">{thresholdError}</p>
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleThresholdCancel}
                  className="flex-1"
                  disabled={thresholdUpdateLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleThresholdSave}
                  disabled={thresholdUpdateLoading}
                  className="flex-1"
                >
                  {thresholdUpdateLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 