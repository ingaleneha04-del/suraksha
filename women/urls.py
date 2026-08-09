"""
URL configuration for women project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from stud import views

urlpatterns = [
    path('admin/', admin.site.urls),

    path('', views.index, name='index'),
    path('home/', views.home, name='home'),

    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),

    path('contacts/', views.get_contacts, name='get_contacts'),
    path('add-contact/', views.add_contact, name='add_contact'),
    path('delete-contact/<int:contact_id>/', views.delete_contact, name='delete_contact'),

    path('sos-trigger/', views.sos_trigger, name='sos_trigger'),
    path('live-location/', views.live_location_update, name='live_location'),
    path('stop-sos/', views.stop_sos, name='stop_sos'),

    path('report-complaint/', views.report_complaint, name='report_complaint'),

    path('subscribe-push/', views.subscribe_push, name='subscribe_push'),
    path('send-push/', views.send_push, name='send_push'),
]


