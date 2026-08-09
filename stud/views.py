from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import logout, authenticate, login
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.views.decorators.http import require_POST
from .models import SOSAlert, EmergencyContact, Complaint, LiveLocation
import json

try:
    from twilio.rest import Client
except ImportError:
    Client = None


# =======================
# INDEX PAGE
# =======================
def index(request):
    return render(request, 'index.html')


# =======================
# LOGIN
# =======================
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user:
            login(request, user)
            return redirect('home')
        else:
            return render(request, 'index.html', {'error': 'Invalid email or password'})

    return render(request, 'index.html')


# =======================
# REGISTER
# =======================
def register_view(request):
    if request.method == 'POST':
        full_name = request.POST.get('full_name')
        email = request.POST.get('email')
        guardian_email = request.POST.get('guardian_email')
        mobile = request.POST.get('mobile_number')
        password = request.POST.get('password')

        if not all([full_name, email, guardian_email, mobile, password]):
            return render(request, 'index.html', {'error': 'All fields are required'})

        if len(password) < 8:
            return render(request, 'index.html', {'error': 'Password must be at least 8 characters'})

        if User.objects.filter(username=email).exists():
            return render(request, 'index.html', {'error': 'User already exists'})

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=full_name
        )

        EmergencyContact.objects.create(
            user=user,
            name='Guardian',
            email=guardian_email,
            phone=mobile
        )

        login(request, user)
        return redirect('home')

    return render(request, 'index.html')


# =======================
# HOME
# =======================
@login_required
def home(request):
    return render(request, 'home.html')


# =======================
# LOGOUT
# =======================
@login_required
def logout_view(request):
    logout(request)
    return redirect('index')


# =======================
# CONTACT APIs
# =======================
@login_required
def get_contacts(request):
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    contacts = EmergencyContact.objects.filter(user=request.user).values(
        'id', 'name', 'phone', 'email'
    )

    return JsonResponse({
        'success': True,
        'contacts': list(contacts)
    })


@login_required
@require_POST
def add_contact(request):
    try:
        data = json.loads(request.body)

        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()
        email = data.get('email', '').strip()

        if not name or not phone:
            return JsonResponse({
                'success': False,
                'error': 'Name and phone are required'
            }, status=400)

        already_exists = EmergencyContact.objects.filter(
            user=request.user,
            phone=phone
        ).exists()

        if already_exists:
            return JsonResponse({
                'success': False,
                'error': 'This contact already exists'
            }, status=400)

        contact = EmergencyContact.objects.create(
            user=request.user,
            name=name,
            phone=phone,
            email=email
        )

        return JsonResponse({
            'success': True,
            'message': 'Contact added successfully',
            'contact': {
                'id': contact.id,
                'name': contact.name,
                'phone': contact.phone,
                'email': contact.email
            }
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@login_required
def delete_contact(request, contact_id):
    if request.method != 'DELETE':
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    try:
        contact = get_object_or_404(EmergencyContact, id=contact_id, user=request.user)
        contact.delete()
        return JsonResponse({
            'success': True,
            'message': 'Contact removed successfully'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# =======================
# SEND SMS
# =======================
def send_sms(phone_numbers, message):
    if Client is None:
        print("Twilio not installed. SMS skipped.")
        return

    if not getattr(settings, 'TWILIO_ACCOUNT_SID', None) or \
       not getattr(settings, 'TWILIO_AUTH_TOKEN', None) or \
       not getattr(settings, 'TWILIO_PHONE_NUMBER', None):
        print("Twilio settings missing. SMS skipped.")
        return

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        for number in phone_numbers:
            try:
                client.messages.create(
                    body=message,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=number
                )
                print(f"SMS sent to {number}")
            except Exception as e:
                print(f"SMS Error for {number}: {e}")

    except Exception as e:
        print("Twilio Client Error:", e)


# =======================
# LIVE LOCATION
# =======================
@login_required
@require_POST
def live_location_update(request):
    try:
        data = json.loads(request.body)
        lat = data.get('lat')
        lon = data.get('lon')

        if lat is None or lon is None:
            return JsonResponse({
                'success': False,
                'message': 'Latitude and longitude are required.'
            }, status=400)

        maps_link = f"https://www.google.com/maps?q={lat},{lon}"

        live_location, created = LiveLocation.objects.get_or_create(
            user=request.user,
            defaults={
                'latitude': str(lat),
                'longitude': str(lon),
                'maps_link': maps_link
            }
        )

        if not created:
            live_location.latitude = str(lat)
            live_location.longitude = str(lon)
            live_location.maps_link = maps_link
            live_location.save()

        return JsonResponse({
            'success': True,
            'message': 'Live location updated successfully.',
            'lat': lat,
            'lon': lon,
            'maps_link': maps_link
        })

    except Exception as e:
        print("Live Location Update Error:", e)
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)


# =======================
# SOS TRIGGER
# =======================
@login_required
@require_POST
def sos_trigger(request):
    try:
        data = json.loads(request.body)

        lat = data.get('lat')
        lon = data.get('lon')
        message = data.get('message', 'Emergency SOS!')

        if lat is None or lon is None:
            return JsonResponse({
                'success': False,
                'message': 'Location missing'
            }, status=400)

        maps_link = f"https://www.google.com/maps?q={lat},{lon}"
        full_message = f"{message}\nLive location: {maps_link}"

        SOSAlert.objects.create(
            user=request.user,
            latitude=str(lat),
            longitude=str(lon),
            message=full_message
        )

        LiveLocation.objects.update_or_create(
            user=request.user,
            defaults={
                'latitude': str(lat),
                'longitude': str(lon),
                'maps_link': maps_link
            }
        )

        contacts = EmergencyContact.objects.filter(user=request.user)
        phone_numbers = [c.phone for c in contacts if c.phone]

        send_sms(phone_numbers, full_message)

        return JsonResponse({
            'success': True,
            'message': 'SOS sent successfully',
            'maps_link': maps_link
        })

    except Exception as e:
        print("SOS Error:", e)
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)


# =======================
# STOP SOS
# =======================
@login_required
@require_POST
def stop_sos(request):
    request.session['sos_active'] = False
    return JsonResponse({
        'success': True,
        'status': 'SOS stopped'
    })


# =======================
# REPORT COMPLAINT
# =======================
@login_required
@require_POST
def report_complaint(request):
    try:
        data = json.loads(request.body)

        subject = data.get('subject', '').strip()
        description = data.get('description', '').strip()

        if not subject or not description:
            return JsonResponse({
                'success': False,
                'error': 'Subject and description are required'
            }, status=400)

        complaint = Complaint.objects.create(
            user=request.user,
            subject=subject,
            description=description
        )

        return JsonResponse({
            'success': True,
            'message': 'Complaint submitted successfully',
            'complaint_id': complaint.id
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# =======================
# PUSH SUBSCRIBE
# =======================
@login_required
@require_POST
def subscribe_push(request):
    try:
        data = json.loads(request.body)
        print("Push subscription:", data)
        return JsonResponse({
            'success': True,
            'status': 'Subscribed'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# =======================
# SEND PUSH
# =======================
@login_required
@require_POST
def send_push(request):
    try:
        data = json.loads(request.body)
        print("Push data:", data)
        return JsonResponse({
            'success': True,
            'status': 'Push sent'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)