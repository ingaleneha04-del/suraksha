from django.contrib import admin
from .models import SOSAlert, EmergencyContact,Complaint, LiveLocation

admin.site.register(SOSAlert)
admin.site.register(EmergencyContact)
admin.site.register(Complaint)
admin.site.register(LiveLocation)
# Register your models here.
